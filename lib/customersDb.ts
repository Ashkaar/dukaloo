import "server-only";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Customer, CustomerInput, CustomerPayment, CustomerSummary, NewCustomerPayment } from "./customers";
import { getDb, getShopDb } from "./db";
import { customerPayments, customers, sales } from "./db/schema";
import type { SaleSummary } from "./sale";

// What a customer owes: credit taken on live sales, less credit refunds and
// repayments. `c` is the customers table's alias in the query.
const BALANCE_SQL = `(
  (SELECT COALESCE(SUM(p.amount_cents), 0) FROM sale_payments p JOIN sales s ON s.id = p.sale_id
     WHERE s.customer_id = c.id AND s.status = 'done' AND p.method = 'credit')
  - (SELECT COALESCE(SUM(r.refund_cents), 0) FROM sale_returns r JOIN sales s ON s.id = r.sale_id
     WHERE s.customer_id = c.id AND r.method = 'credit' AND s.status = 'done')
  - (SELECT COALESCE(SUM(cp.amount_cents), 0) FROM customer_payments cp WHERE cp.customer_id = c.id AND cp.deleted_at IS NULL)
)`;

const toCustomer = (r: typeof customers.$inferSelect): Customer => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  note: r.note,
  createdAt: r.createdAt,
});

// Searched by name or phone, with what each has bought (voided sales and
// refunds left out), a page at a time.
export async function listCustomers(q: string, limit: number, offset: number): Promise<{ items: CustomerSummary[]; total: number }> {
  const { client } = await getShopDb();
  const where = ["c.archived_at IS NULL"];
  const args: (string | number)[] = [];
  const needle = q.trim();
  if (needle) {
    const like = `%${needle.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    const digits = needle.replace(/\D/g, "");
    where.push(`(c.name LIKE ? ESCAPE '\\' ${digits.length >= 3 ? "OR c.phone LIKE ?" : ""})`);
    args.push(like);
    if (digits.length >= 3) args.push(`%${digits}%`);
  }
  const whereSql = where.join(" AND ");
  const [{ rows }, count] = await Promise.all([
    client.execute({
      sql: `SELECT c.*,
              (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id AND s.status = 'done') AS visits,
              (SELECT COALESCE(SUM(s.total_cents), 0) FROM sales s WHERE s.customer_id = c.id AND s.status = 'done')
                - (SELECT COALESCE(SUM(r.refund_cents), 0) FROM sale_returns r JOIN sales s ON s.id = r.sale_id WHERE s.customer_id = c.id) AS spent,
              (SELECT MAX(s.at) FROM sales s WHERE s.customer_id = c.id AND s.status = 'done') AS last_visit,
              ${BALANCE_SQL} AS balance
            FROM customers c WHERE ${whereSql}
            ORDER BY c.name COLLATE NOCASE, c.id LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    }),
    client.execute({ sql: `SELECT COUNT(*) AS n FROM customers c WHERE ${whereSql}`, args }),
  ]);
  return {
    total: Number(count.rows[0]?.n ?? 0),
    items: rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      phone: String(r.phone ?? ""),
      email: String(r.email ?? ""),
      address: String(r.address ?? ""),
      note: String(r.note ?? ""),
      createdAt: Number(r.created_at),
      visits: Number(r.visits ?? 0),
      spentCents: Number(r.spent ?? 0),
      lastVisit: r.last_visit == null ? null : Number(r.last_visit),
      balanceCents: Number(r.balance ?? 0),
    })),
  };
}

export async function getCustomer(id: number): Promise<Customer | null> {
  const db = await getDb();
  const [row] = await db.select().from(customers).where(and(eq(customers.id, id), isNull(customers.archivedAt)));
  return row ? toCustomer(row) : null;
}

export async function phoneTaken(phone: string, exceptId = 0): Promise<Customer | null> {
  if (!phone) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.phone, phone), isNull(customers.archivedAt), ne(customers.id, exceptId)));
  return row ? toCustomer(row) : null;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const db = await getDb();
  const [row] = await db
    .insert(customers)
    .values({ ...input, createdAt: Date.now() })
    .returning();
  return toCustomer(row);
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<Customer | null> {
  const db = await getDb();
  const [row] = await db
    .update(customers)
    .set(input)
    .where(and(eq(customers.id, id), isNull(customers.archivedAt)))
    .returning();
  return row ? toCustomer(row) : null;
}

// Kept for the records of past sales; gone from lists and the till.
export async function archiveCustomer(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(customers)
    .set({ archivedAt: Date.now() })
    .where(and(eq(customers.id, id), isNull(customers.archivedAt)))
    .returning({ id: customers.id });
  return rows.length > 0;
}

// A customer's sales, newest first.
export async function customerSales(id: number, limit = 200): Promise<SaleSummary[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: sales.id,
      number: sales.number,
      at: sales.at,
      staffName: sales.staffName,
      status: sales.status,
      totalCents: sales.totalCents,
      itemCount: sql<number>`(SELECT COUNT(*) FROM sale_lines l WHERE l.sale_id = sales.id)`,
      refundedCents: sql<number>`(SELECT COALESCE(SUM(r.refund_cents), 0) FROM sale_returns r WHERE r.sale_id = sales.id)`,
    })
    .from(sales)
    .where(eq(sales.customerId, id))
    .orderBy(desc(sales.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    at: r.at,
    staffName: r.staffName,
    status: r.status === "voided" ? "voided" : "done",
    totalCents: r.totalCents,
    itemCount: Number(r.itemCount),
    methods: [],
    refundedCents: Number(r.refundedCents),
  }));
}

// ---- Credit: balances and repayments -------------------------------------------

export async function customerBalance(id: number): Promise<number> {
  const { client } = await getShopDb();
  const { rows } = await client.execute({ sql: `SELECT ${BALANCE_SQL} AS balance FROM customers c WHERE c.id = ?`, args: [id] });
  return Number(rows[0]?.balance ?? 0);
}

// What all customers owe together, right now.
export async function totalOwed(): Promise<number> {
  const { client } = await getShopDb();
  const { rows } = await client.execute(`SELECT COALESCE(SUM(b), 0) AS owed FROM (SELECT ${BALANCE_SQL} AS b FROM customers c) WHERE b > 0`);
  return Number(rows[0]?.owed ?? 0);
}

export async function customerPaymentsOf(id: number): Promise<CustomerPayment[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(customerPayments)
    .where(and(eq(customerPayments.customerId, id), isNull(customerPayments.deletedAt)))
    .orderBy(desc(customerPayments.at))
    .limit(500);
  return rows.map((r) => ({ id: r.id, at: r.at, amountCents: r.amountCents, method: r.method as CustomerPayment["method"], note: r.note, staffName: r.staffName }));
}

// Records money paid towards a customer's account. A retry with the same
// clientId records nothing new.
export async function recordCustomerPayment(customerId: number, input: NewCustomerPayment, actor: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(customerPayments)
    .values({ customerId, clientId: input.clientId, at: Date.now(), amountCents: input.amountCents, method: input.method, note: input.note, staffName: actor })
    .onConflictDoNothing();
}

export async function deleteCustomerPayment(customerId: number, paymentId: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(customerPayments)
    .set({ deletedAt: Date.now() })
    .where(and(eq(customerPayments.id, paymentId), eq(customerPayments.customerId, customerId), isNull(customerPayments.deletedAt)))
    .returning({ id: customerPayments.id });
  return rows.length > 0;
}
