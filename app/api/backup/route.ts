import type { NextRequest } from "next/server";
import { badRequest, ok, requireOwner, serverError } from "@/lib/api";
import { getShopDb } from "@/lib/db";

// A copy of the shop's data, a table and a page at a time (the browser puts
// the file together, so no single response gets too big). Owner only.
// Sign-in secrets are never included.

const BY_ID = [
  "categories",
  "products",
  "product_variants",
  "stock_moves",
  "sales",
  "sale_lines",
  "sale_payments",
  "sale_returns",
  "sale_return_lines",
  "customers",
  "suppliers",
  "purchases",
  "purchase_lines",
  "expense_types",
  "expenses",
  "staff",
  "activity_log",
];
const WHOLE = ["shop_settings", "text_overrides"];
const PAGE = 2000;

const BACKUP_TABLES = [...BY_ID, ...WHOLE];

// GET → the list of tables. GET ?table=&after= → up to 2,000 rows after that id.
export async function GET(request: NextRequest) {
  const { error } = await requireOwner();
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const table = params.get("table");
  if (!table) return ok({ tables: BACKUP_TABLES, page: PAGE });
  if (!BACKUP_TABLES.includes(table)) return badRequest();
  try {
    const { client } = await getShopDb();
    if (WHOLE.includes(table)) {
      const { rows } = await client.execute(`SELECT * FROM ${table}`);
      return ok({ rows, next: null });
    }
    const after = Number(params.get("after") ?? 0);
    if (!Number.isInteger(after) || after < 0) return badRequest();
    const { rows } = await client.execute({ sql: `SELECT * FROM ${table} WHERE id > ? ORDER BY id LIMIT ?`, args: [after, PAGE] });
    // Staff password hashes stay out of the file.
    const safe = table === "staff" ? rows.map((r) => ({ ...r, password_hash: "" })) : rows;
    return ok({ rows: safe, next: rows.length === PAGE ? Number(rows[rows.length - 1].id) : null });
  } catch (err) {
    return serverError("export a backup", err);
  }
}
