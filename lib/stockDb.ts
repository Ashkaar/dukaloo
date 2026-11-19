import "server-only";
import { inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { stockMoves } from "./db/schema";

// Stock is a list of movements (stock_moves); a variant's level is their
// sum. Sales, returns, purchases and counts only ever add rows, so tills
// that sync later never overwrite each other.

export type StockKind = "opening" | "adjust" | "count" | "sale" | "void" | "return" | "purchase";

export async function stockLevels(variantIds: number[]): Promise<Map<number, number>> {
  if (variantIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ variantId: stockMoves.variantId, qty: sql<number>`SUM(${stockMoves.qtyMilli})` })
    .from(stockMoves)
    .where(inArray(stockMoves.variantId, variantIds))
    .groupBy(stockMoves.variantId);
  return new Map(rows.map((r) => [r.variantId, Number(r.qty)]));
}

// "set": the shelf count is now `qtyMilli` (records the difference);
// "add" / "remove": that many arrived or left.
export async function adjustStock(variantId: number, mode: "set" | "add" | "remove", qtyMilli: number, note: string, actor: string): Promise<number> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ qty: sql<number>`COALESCE(SUM(${stockMoves.qtyMilli}), 0)` })
      .from(stockMoves)
      .where(sql`${stockMoves.variantId} = ${variantId}`);
    const current = Number(row?.qty ?? 0);
    const change = mode === "set" ? qtyMilli - current : mode === "add" ? qtyMilli : -qtyMilli;
    if (change !== 0) {
      await tx.insert(stockMoves).values({ variantId, qtyMilli: change, kind: mode === "set" ? "count" : "adjust", note, actor, at: Date.now() });
    }
    return current + change;
  });
}
