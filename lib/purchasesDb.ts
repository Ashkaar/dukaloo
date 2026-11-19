import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { variantLabel } from "./catalog";
import type { CustomerInput } from "./customers";
import { getDb } from "./db";
import { products, productVariants, purchaseLines, purchases, shopSettings, stockMoves, suppliers } from "./db/schema";
import { lineCost, type BuyableItem, type NewPurchase, type Purchase, type PurchaseSummary, type Supplier } from "./purchases";

const parse = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

const toSupplier = (r: typeof suppliers.$inferSelect): Supplier => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  note: r.note,
  createdAt: r.createdAt,
});

// ---- Suppliers ----------------------------------------------------------------

export async function listSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  return (await db.select().from(suppliers).where(isNull(suppliers.archivedAt)).orderBy(sql`${suppliers.name} COLLATE NOCASE`)).map(toSupplier);
}

export async function createSupplier(input: CustomerInput): Promise<Supplier> {
  const db = await getDb();
  const [row] = await db
    .insert(suppliers)
    .values({ ...input, createdAt: Date.now() })
    .returning();
  return toSupplier(row);
}

export async function updateSupplier(id: number, input: CustomerInput): Promise<Supplier | null> {
  const db = await getDb();
  const [row] = await db
    .update(suppliers)
    .set(input)
    .where(and(eq(suppliers.id, id), isNull(suppliers.archivedAt)))
    .returning();
  return row ? toSupplier(row) : null;
}

export async function archiveSupplier(id: number): Promise<boolean> {
  const db = await getDb();
  return (
    await db
      .update(suppliers)
      .set({ archivedAt: Date.now() })
      .where(and(eq(suppliers.id, id), isNull(suppliers.archivedAt)))
      .returning({ id: suppliers.id })
  ).length > 0;
}

// ---- Purchases ----------------------------------------------------------------

// Everything that can be bought in: live variants, on sale or not.
export async function buyableItems(): Promise<BuyableItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      variantId: productVariants.id,
      name: products.name,
      options: productVariants.options,
      unit: products.unit,
      barcode: productVariants.barcode,
      sku: productVariants.sku,
      costCents: productVariants.costCents,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(isNull(productVariants.archivedAt), isNull(products.archivedAt)))
    .orderBy(sql`${products.name} COLLATE NOCASE`, asc(productVariants.sortOrder))
    .limit(20_000);
  return rows.map((r) => ({ ...r, variantLabel: variantLabel({ options: parse(r.options) }) }));
}

export type PurchaseResult = { ok: true; purchase: Purchase } | { ok: false; reason: "supplier" | "item" };

// Records stock coming in: lines at the price paid, stock up for counted
// items, and (if asked) each item's cost price set to the new one.
export async function createPurchase(input: NewPurchase, actor: string): Promise<PurchaseResult> {
  const db = await getDb();
  const [seen] = await db.select({ id: purchases.id }).from(purchases).where(eq(purchases.clientId, input.clientId));
  if (seen) return { ok: true, purchase: (await getPurchase(seen.id))! };

  let supplierName = "";
  if (input.supplierId !== null) {
    const [s] = await db
      .select({ name: suppliers.name })
      .from(suppliers)
      .where(and(eq(suppliers.id, input.supplierId), isNull(suppliers.archivedAt)));
    if (!s) return { ok: false, reason: "supplier" };
    supplierName = s.name;
  }
  const ids = [...new Set(input.lines.map((l) => l.variantId))];
  const rows = await db
    .select({ variantId: productVariants.id, productId: products.id, name: products.name, options: productVariants.options, trackStock: products.trackStock })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(inArray(productVariants.id, ids), isNull(productVariants.archivedAt), isNull(products.archivedAt)));
  const byId = new Map(rows.map((r) => [r.variantId, r]));
  if (ids.some((id) => !byId.has(id))) return { ok: false, reason: "item" };

  const lines = input.lines.map((l) => ({ ...l, totalCents: lineCost(l.qtyMilli, l.unitCostCents) }));
  const at = Date.now();
  const id = await db.transaction(async (tx) => {
    const [counter] = await tx
      .insert(shopSettings)
      .values({ key: "purchase_counter", value: "1" })
      .onConflictDoUpdate({ target: shopSettings.key, set: { value: sql`CAST(${shopSettings.value} AS INTEGER) + 1` } })
      .returning({ value: shopSettings.value });
    const [p] = await tx
      .insert(purchases)
      .values({
        number: Number(counter.value),
        clientId: input.clientId,
        at,
        supplierId: input.supplierId,
        supplierName,
        reference: input.reference,
        note: input.note,
        totalCents: lines.reduce((s, l) => s + l.totalCents, 0),
        staffName: actor,
      })
      .returning({ id: purchases.id });
    await tx.insert(purchaseLines).values(
      lines.map((l) => {
        const v = byId.get(l.variantId)!;
        return { purchaseId: p.id, variantId: l.variantId, productId: v.productId, name: v.name, variantLabel: variantLabel({ options: parse(v.options) }), qtyMilli: l.qtyMilli, unitCostCents: l.unitCostCents, totalCents: l.totalCents };
      }),
    );
    const tracked = lines.filter((l) => byId.get(l.variantId)!.trackStock === 1);
    if (tracked.length > 0) {
      await tx.insert(stockMoves).values(tracked.map((l) => ({ variantId: l.variantId, qtyMilli: l.qtyMilli, kind: "purchase", refId: p.id, actor, at })));
    }
    if (input.updateCosts) {
      // The last line for an item wins if it appears twice.
      for (const l of lines) await tx.update(productVariants).set({ costCents: l.unitCostCents, updatedAt: at }).where(eq(productVariants.id, l.variantId));
    }
    return p.id;
  });
  return { ok: true, purchase: (await getPurchase(id))! };
}

export async function getPurchase(id: number): Promise<Purchase | null> {
  const db = await getDb();
  const [p] = await db.select().from(purchases).where(eq(purchases.id, id));
  if (!p) return null;
  const lines = await db.select().from(purchaseLines).where(eq(purchaseLines.purchaseId, id)).orderBy(purchaseLines.id);
  return {
    id: p.id,
    number: p.number,
    at: p.at,
    supplierId: p.supplierId,
    supplierName: p.supplierName,
    reference: p.reference,
    note: p.note,
    totalCents: p.totalCents,
    staffName: p.staffName,
    status: p.status === "cancelled" ? "cancelled" : "received",
    lines: lines.map((l) => ({ variantId: l.variantId, name: l.name, variantLabel: l.variantLabel, qtyMilli: l.qtyMilli, unitCostCents: l.unitCostCents, totalCents: l.totalCents })),
  };
}

export async function listPurchases(limit: number, offset: number): Promise<{ items: PurchaseSummary[]; total: number }> {
  const db = await getDb();
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: purchases.id,
        number: purchases.number,
        at: purchases.at,
        supplierName: purchases.supplierName,
        reference: purchases.reference,
        totalCents: purchases.totalCents,
        status: purchases.status,
        itemCount: sql<number>`(SELECT COUNT(*) FROM purchase_lines l WHERE l.purchase_id = ${purchases.id})`,
      })
      .from(purchases)
      .orderBy(desc(purchases.at))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`COUNT(*)` }).from(purchases),
  ]);
  return {
    total: Number(count?.n ?? 0),
    items: rows.map((r) => ({ ...r, status: r.status === "cancelled" ? "cancelled" : "received", itemCount: Number(r.itemCount) })),
  };
}

// Takes a purchase entered by mistake back out of stock. Cost prices stay.
export async function cancelPurchase(id: number, actor: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const at = Date.now();
    const done = await tx
      .update(purchases)
      .set({ status: "cancelled", cancelledAt: at, cancelledBy: actor })
      .where(and(eq(purchases.id, id), eq(purchases.status, "received")))
      .returning({ id: purchases.id });
    if (done.length === 0) return false;
    const moves = await tx.select().from(stockMoves).where(and(eq(stockMoves.refId, id), eq(stockMoves.kind, "purchase")));
    if (moves.length > 0) {
      await tx.insert(stockMoves).values(moves.map((m) => ({ variantId: m.variantId, qtyMilli: -m.qtyMilli, kind: "adjust", refId: id, note: "purchase cancelled", actor, at })));
    }
    return true;
  });
}
