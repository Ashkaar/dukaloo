import "server-only";
import { and, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "./db";
import { expenses, expenseTypes } from "./db/schema";
import type { Expense, ExpenseType, NewExpense } from "./expenses";
import type { PaymentMethod } from "./sale";

export async function listExpenseTypes(): Promise<ExpenseType[]> {
  const db = await getDb();
  return db.select({ id: expenseTypes.id, name: expenseTypes.name }).from(expenseTypes).orderBy(sql`${expenseTypes.name} COLLATE NOCASE`);
}

export async function expenseTypeTaken(name: string, exceptId = 0): Promise<boolean> {
  const db = await getDb();
  return (await db.select({ id: expenseTypes.id }).from(expenseTypes).where(and(sql`${expenseTypes.name} = ${name} COLLATE NOCASE`, ne(expenseTypes.id, exceptId)))).length > 0;
}

export async function createExpenseType(name: string): Promise<ExpenseType> {
  const db = await getDb();
  const [row] = await db.insert(expenseTypes).values({ name, createdAt: Date.now() }).returning();
  return { id: row.id, name: row.name };
}

export async function renameExpenseType(id: number, name: string): Promise<boolean> {
  const db = await getDb();
  return (await db.update(expenseTypes).set({ name }).where(eq(expenseTypes.id, id)).returning({ id: expenseTypes.id })).length > 0;
}

// Its expenses stay, without a type.
export async function deleteExpenseType(id: number): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.update(expenses).set({ typeId: null }).where(eq(expenses.typeId, id));
    return (await tx.delete(expenseTypes).where(eq(expenseTypes.id, id)).returning({ id: expenseTypes.id })).length > 0;
  });
}

const select = {
  id: expenses.id,
  day: expenses.day,
  typeId: expenses.typeId,
  typeName: sql<string>`COALESCE(${expenseTypes.name}, '')`,
  amountCents: expenses.amountCents,
  method: expenses.method,
  note: expenses.note,
  staffName: expenses.staffName,
  createdAt: expenses.createdAt,
};

// Expenses on days from `from` up to (not including) `to` ("YYYY-MM-DD").
export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db
    .select(select)
    .from(expenses)
    .leftJoin(expenseTypes, eq(expenseTypes.id, expenses.typeId))
    .where(and(gte(expenses.day, from), lt(expenses.day, to), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.day), desc(expenses.createdAt))
    .limit(5000);
  return rows.map((r) => ({ ...r, method: r.method as PaymentMethod }));
}

export type CreateExpenseResult = { ok: true; expense: Expense } | { ok: false; reason: "type" };

export async function createExpense(input: NewExpense, actor: string): Promise<CreateExpenseResult> {
  const db = await getDb();
  const byClient = async () => {
    const [row] = await db.select(select).from(expenses).leftJoin(expenseTypes, eq(expenseTypes.id, expenses.typeId)).where(eq(expenses.clientId, input.clientId));
    return row ? { ...row, method: row.method as PaymentMethod } : null;
  };
  const seen = await byClient();
  if (seen) return { ok: true, expense: seen };
  if (input.typeId !== null && (await db.select({ id: expenseTypes.id }).from(expenseTypes).where(eq(expenseTypes.id, input.typeId))).length === 0) {
    return { ok: false, reason: "type" };
  }
  await db.insert(expenses).values({ ...input, staffName: actor, createdAt: Date.now() }).onConflictDoNothing();
  return { ok: true, expense: (await byClient())! };
}

// Kept in the database for the record, gone from lists and totals.
export async function deleteExpense(id: number): Promise<boolean> {
  const db = await getDb();
  return (await db.update(expenses).set({ deletedAt: Date.now() }).where(and(eq(expenses.id, id), isNull(expenses.deletedAt))).returning({ id: expenses.id })).length > 0;
}
