import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { variantLabel } from "./catalog";
import { getDb } from "./db";
import { products, productVariants, salePayments, saleLines, saleReturnLines, saleReturns, sales, shopSettings, stockMoves } from "./db/schema";
import { computeTotals, refundFor, settle, type NewReturn, type NewSale, type PaymentMethod, type Sale, type SaleSummary, type SalesSettings, type TillItem } from "./sale";
import { stockLevels } from "./stockDb";

const parse = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

// Everything the till can sell, with stock levels: live, on-sale variants
// of live, on-sale products. Loaded once by the till and searched there.
export async function tillItems(): Promise<TillItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      name: products.name,
      options: productVariants.options,
      categoryId: products.categoryId,
      unit: products.unit,
      barcode: productVariants.barcode,
      sku: productVariants.sku,
      priceCents: productVariants.priceCents,
      trackStock: products.trackStock,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(isNull(productVariants.archivedAt), isNull(products.archivedAt), eq(products.active, 1), eq(productVariants.active, 1)))
    .orderBy(sql`${products.name} COLLATE NOCASE`, productVariants.sortOrder)
    .limit(20_000);
  const levels = await stockLevels(rows.map((r) => r.variantId));
  return rows.map((r) => ({
    variantId: r.variantId,
    productId: r.productId,
    name: r.name,
    variantLabel: variantLabel({ options: parse(r.options) }),
    categoryId: r.categoryId,
    unit: r.unit,
    barcode: r.barcode,
    sku: r.sku,
    priceCents: r.priceCents,
    trackStock: r.trackStock === 1,
    stockMilli: levels.get(r.variantId) ?? 0,
  }));
}

export type CreateResult =
  | { ok: true; sale: Sale }
  | { ok: false; reason: "unavailable"; name: string }
  | { ok: false; reason: "stock"; name: string }
  | { ok: false; reason: "changed"; totalCents: number }
  | { ok: false; reason: "payment" };

// Records a sale from the database's own prices. The till's total is only
// compared, never trusted.
export async function createSale(input: NewSale, settings: SalesSettings, decimals: 0 | 2, staff: { id: number | null; name: string }): Promise<CreateResult> {
  const db = await getDb();
  const existing = await db.select({ id: sales.id }).from(sales).where(eq(sales.clientId, input.clientId));
  if (existing[0]) return { ok: true, sale: (await getSale(existing[0].id))! };

  const ids = [...new Set(input.lines.map((l) => l.variantId))];
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      name: products.name,
      options: productVariants.options,
      unit: products.unit,
      priceCents: productVariants.priceCents,
      costCents: productVariants.costCents,
      trackStock: products.trackStock,
      live: sql<number>`(${productVariants.archivedAt} IS NULL AND ${products.archivedAt} IS NULL AND ${products.active} = 1 AND ${productVariants.active} = 1)`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, ids));
  const byId = new Map(rows.map((r) => [r.variantId, r]));
  for (const l of input.lines) {
    const v = byId.get(l.variantId);
    if (!v || Number(v.live) !== 1) return { ok: false, reason: "unavailable", name: v?.name ?? "" };
  }

  if (!settings.allowNegativeStock) {
    const levels = await stockLevels(ids);
    const wanted = new Map<number, number>();
    for (const l of input.lines) wanted.set(l.variantId, (wanted.get(l.variantId) ?? 0) + l.qtyMilli);
    for (const [id, qty] of wanted) {
      const v = byId.get(id)!;
      if (v.trackStock === 1 && (levels.get(id) ?? 0) < qty) {
        const label = variantLabel({ options: parse(v.options) });
        return { ok: false, reason: "stock", name: label ? `${v.name} (${label})` : v.name };
      }
    }
  }

  const totals = computeTotals(
    input.lines.map((l) => ({ unitPriceCents: byId.get(l.variantId)!.priceCents, qtyMilli: l.qtyMilli, discountCents: l.discountCents })),
    input.discount,
    settings.tax,
    decimals,
  );
  if (totals.totalCents !== input.expectedTotalCents) return { ok: false, reason: "changed", totalCents: totals.totalCents };
  const payments = input.payments.filter((p) => p.cents > 0);
  const settled = settle(totals.totalCents, payments);
  if (!settled) return { ok: false, reason: "payment" };

  const at = Date.now();
  try {
    const saleId = await db.transaction(async (tx) => {
      const [counter] = await tx
        .insert(shopSettings)
        .values({ key: "receipt_counter", value: "1" })
        .onConflictDoUpdate({ target: shopSettings.key, set: { value: sql`CAST(${shopSettings.value} AS INTEGER) + 1` } })
        .returning({ value: shopSettings.value });
      const [sale] = await tx
        .insert(sales)
        .values({
          number: Number(counter.value),
          clientId: input.clientId,
          at,
          staffId: staff.id,
          staffName: staff.name,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          taxCents: totals.taxCents,
          taxName: settings.tax.enabled ? settings.tax.name : "",
          taxRateBp: settings.tax.enabled ? settings.tax.rateBp : 0,
          taxInclusive: settings.tax.inclusive ? 1 : 0,
          totalCents: totals.totalCents,
          paidCents: settled.paidCents,
          changeCents: settled.changeCents,
          note: input.note,
        })
        .returning({ id: sales.id });
      await tx.insert(saleLines).values(
        input.lines.map((l, i) => {
          const v = byId.get(l.variantId)!;
          return {
            saleId: sale.id,
            variantId: v.variantId,
            productId: v.productId,
            name: v.name,
            variantLabel: variantLabel({ options: parse(v.options) }),
            unit: v.unit,
            qtyMilli: l.qtyMilli,
            unitPriceCents: v.priceCents,
            discountCents: totals.lines[i].discountCents,
            totalCents: totals.lines[i].netCents,
            costCents: v.costCents,
          };
        }),
      );
      await tx.insert(salePayments).values(payments.map((p) => ({ saleId: sale.id, method: p.method, amountCents: p.cents })));
      const tracked = input.lines.filter((l) => byId.get(l.variantId)!.trackStock === 1);
      if (tracked.length > 0) {
        await tx.insert(stockMoves).values(tracked.map((l) => ({ variantId: l.variantId, qtyMilli: -l.qtyMilli, kind: "sale", refId: sale.id, actor: staff.name, at })));
      }
      return sale.id;
    });
    return { ok: true, sale: (await getSale(saleId))! };
  } catch (err) {
    // The same sale arriving twice at once: the second finds the first.
    if (String(err).includes("UNIQUE") && String(err).includes("client_id")) {
      const [again] = await db.select({ id: sales.id }).from(sales).where(eq(sales.clientId, input.clientId));
      if (again) return { ok: true, sale: (await getSale(again.id))! };
    }
    throw err;
  }
}

export async function getSale(id: number): Promise<Sale | null> {
  const db = await getDb();
  const [s] = await db.select().from(sales).where(eq(sales.id, id));
  if (!s) return null;
  const [lines, payments, returns] = await Promise.all([
    db.select().from(saleLines).where(eq(saleLines.saleId, id)).orderBy(saleLines.id),
    db.select().from(salePayments).where(eq(salePayments.saleId, id)).orderBy(salePayments.id),
    db.select().from(saleReturns).where(eq(saleReturns.saleId, id)).orderBy(saleReturns.id),
  ]);
  const returnLines = returns.length
    ? await db.select().from(saleReturnLines).where(inArray(saleReturnLines.returnId, returns.map((r) => r.id)))
    : [];
  const returned = new Map<number, number>();
  for (const rl of returnLines) returned.set(rl.saleLineId, (returned.get(rl.saleLineId) ?? 0) + rl.qtyMilli);
  return {
    id: s.id,
    number: s.number,
    at: s.at,
    staffName: s.staffName,
    status: s.status === "voided" ? "voided" : "done",
    subtotalCents: s.subtotalCents,
    discountCents: s.discountCents,
    taxCents: s.taxCents,
    taxName: s.taxName,
    taxRateBp: s.taxRateBp,
    taxInclusive: s.taxInclusive === 1,
    totalCents: s.totalCents,
    paidCents: s.paidCents,
    changeCents: s.changeCents,
    note: s.note,
    lines: lines.map((l) => ({
      id: l.id,
      returnedMilli: returned.get(l.id) ?? 0,
      variantId: l.variantId,
      name: l.name,
      variantLabel: l.variantLabel,
      unit: l.unit,
      qtyMilli: l.qtyMilli,
      unitPriceCents: l.unitPriceCents,
      discountCents: l.discountCents,
      totalCents: l.totalCents,
    })),
    payments: payments.map((p) => ({ method: p.method as PaymentMethod, cents: p.amountCents })),
    returns: returns.map((r) => ({
      id: r.id,
      at: r.at,
      staffName: r.staffName,
      refundCents: r.refundCents,
      method: r.method as PaymentMethod,
      note: r.note,
      lines: returnLines.filter((rl) => rl.returnId === r.id).map((rl) => ({ saleLineId: rl.saleLineId, qtyMilli: rl.qtyMilli, refundCents: rl.refundCents })),
    })),
    refundedCents: returns.reduce((sum, r) => sum + r.refundCents, 0),
  };
}

// Sales between two times (ms), newest first, with the period's totals:
// takings by payment method after change, less refunds given in the period.
export async function listSales(
  from: number,
  to: number,
): Promise<{ sales: SaleSummary[]; totals: { count: number; totalCents: number; refundCents: number; byMethod: Record<PaymentMethod, number> } }> {
  const db = await getDb();
  const rows = await db
    .select({
      id: sales.id,
      number: sales.number,
      at: sales.at,
      staffName: sales.staffName,
      status: sales.status,
      totalCents: sales.totalCents,
      changeCents: sales.changeCents,
      itemCount: sql<number>`(SELECT COUNT(*) FROM sale_lines l WHERE l.sale_id = ${sales.id})`,
    })
    .from(sales)
    .where(and(gte(sales.at, from), lt(sales.at, to)))
    .orderBy(desc(sales.at))
    .limit(2000);
  const payments = rows.length
    ? await db.select().from(salePayments).where(inArray(salePayments.saleId, rows.map((r) => r.id)))
    : [];
  const methods = new Map<number, PaymentMethod[]>();
  const byMethod: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0 };
  const done = new Set(rows.filter((r) => r.status !== "voided").map((r) => r.id));
  for (const p of payments) {
    const m = p.method as PaymentMethod;
    methods.set(p.saleId, [...new Set([...(methods.get(p.saleId) ?? []), m])]);
    if (done.has(p.saleId) && m in byMethod) byMethod[m] += p.amountCents;
  }
  // Change given back comes out of the cash.
  for (const r of rows) if (done.has(r.id)) byMethod.cash -= r.changeCents;
  // Refunds given in this period (whenever the sale was).
  const refunds = await db
    .select({ saleId: saleReturns.saleId, method: saleReturns.method, cents: saleReturns.refundCents })
    .from(saleReturns)
    .where(and(gte(saleReturns.at, from), lt(saleReturns.at, to)));
  let refundCents = 0;
  for (const r of refunds) {
    refundCents += r.cents;
    if (r.method in byMethod) byMethod[r.method as PaymentMethod] -= r.cents;
  }
  const refundedBySale = new Map<number, number>();
  if (rows.length) {
    const all = await db
      .select({ saleId: saleReturns.saleId, cents: sql<number>`SUM(${saleReturns.refundCents})` })
      .from(saleReturns)
      .where(inArray(saleReturns.saleId, rows.map((r) => r.id)))
      .groupBy(saleReturns.saleId);
    for (const r of all) refundedBySale.set(r.saleId, Number(r.cents));
  }
  const live = rows.filter((r) => r.status !== "voided");
  return {
    sales: rows.map((r) => ({
      id: r.id,
      number: r.number,
      at: r.at,
      staffName: r.staffName,
      status: r.status === "voided" ? "voided" : "done",
      totalCents: r.totalCents,
      itemCount: Number(r.itemCount),
      methods: methods.get(r.id) ?? [],
      refundedCents: refundedBySale.get(r.id) ?? 0,
    })),
    totals: { count: live.length, totalCents: live.reduce((s, r) => s + r.totalCents, 0) - refundCents, refundCents, byMethod },
  };
}

// Cancels a sale: it stays in the records as voided, and its items go back into stock.
export async function voidSale(id: number, actor: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const at = Date.now();
    const done = await tx
      .update(sales)
      .set({ status: "voided", voidedAt: at, voidedBy: actor })
      .where(and(eq(sales.id, id), eq(sales.status, "done")))
      .returning({ id: sales.id });
    if (done.length === 0) return false;
    // Put back what the sale took out, less what returns already put back.
    const taken = await tx.select().from(stockMoves).where(and(eq(stockMoves.refId, id), eq(stockMoves.kind, "sale")));
    const back = await tx
      .select({ variantId: stockMoves.variantId, qty: sql<number>`SUM(${stockMoves.qtyMilli})` })
      .from(stockMoves)
      .innerJoin(saleReturns, eq(saleReturns.id, stockMoves.refId))
      .where(and(eq(stockMoves.kind, "return"), eq(saleReturns.saleId, id)))
      .groupBy(stockMoves.variantId);
    const returnedBack = new Map(back.map((r) => [r.variantId, Number(r.qty)]));
    const byVariant = new Map<number, number>();
    for (const m of taken) byVariant.set(m.variantId, (byVariant.get(m.variantId) ?? 0) - m.qtyMilli);
    const moves = [...byVariant].map(([variantId, qty]) => ({ variantId, qty: qty - (returnedBack.get(variantId) ?? 0) })).filter((m) => m.qty > 0);
    if (moves.length > 0) {
      await tx.insert(stockMoves).values(moves.map((m) => ({ variantId: m.variantId, qtyMilli: m.qty, kind: "void", refId: id, actor, at })));
    }
    return true;
  });
}

export type ReturnResult = { ok: true; sale: Sale } | { ok: false; reason: "not-found" | "voided" | "too-many" };

// Gives items back from a sale: refunds each line's share of what was paid,
// and puts counted items back into stock. A retry with the same clientId
// records nothing new.
export async function createReturn(saleId: number, input: NewReturn, decimals: 0 | 2, actor: string): Promise<ReturnResult> {
  const db = await getDb();
  const sale = await getSale(saleId);
  if (!sale) return { ok: false, reason: "not-found" };
  const [seen] = await db.select({ id: saleReturns.id }).from(saleReturns).where(eq(saleReturns.clientId, input.clientId));
  if (seen) return { ok: true, sale };
  if (sale.status === "voided") return { ok: false, reason: "voided" };

  const wanted = new Map<number, number>();
  for (const l of input.lines) wanted.set(l.saleLineId, (wanted.get(l.saleLineId) ?? 0) + l.qtyMilli);
  const lines = [...wanted].map(([lineId, qty]) => ({ line: sale.lines.find((l) => l.id === lineId), qty }));
  if (lines.some(({ line, qty }) => !line || qty > line.qtyMilli - line.returnedMilli)) return { ok: false, reason: "too-many" };

  const refunds = lines.map(({ line, qty }) => {
    const l = line!;
    // The last of a line refunds exactly what is left of it, so rounding never drifts.
    const paidForLine = refundFor(sale, l, l.qtyMilli, decimals);
    const before = refundFor(sale, l, l.returnedMilli, decimals);
    const after = l.returnedMilli + qty >= l.qtyMilli ? paidForLine : refundFor(sale, l, l.returnedMilli + qty, decimals);
    return { line: l, qty, cents: Math.max(0, after - before) };
  });
  const refundCents = Math.min(
    refunds.reduce((s, r) => s + r.cents, 0),
    sale.totalCents - sale.refundedCents,
  );

  const tracked = new Set(
    (
      await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(and(inArray(productVariants.id, refunds.map((r) => r.line.variantId)), eq(products.trackStock, 1)))
    ).map((r) => r.id),
  );
  const at = Date.now();
  await db.transaction(async (tx) => {
    const [ret] = await tx
      .insert(saleReturns)
      .values({ saleId, clientId: input.clientId, at, staffName: actor, refundCents, method: input.method, note: input.note })
      .returning({ id: saleReturns.id });
    await tx.insert(saleReturnLines).values(refunds.map((r) => ({ returnId: ret.id, saleLineId: r.line.id, variantId: r.line.variantId, qtyMilli: r.qty, refundCents: r.cents })));
    const back = refunds.filter((r) => tracked.has(r.line.variantId));
    if (back.length > 0) {
      await tx.insert(stockMoves).values(back.map((r) => ({ variantId: r.line.variantId, qtyMilli: r.qty, kind: "return", refId: ret.id, actor, at })));
    }
  });
  return { ok: true, sale: (await getSale(saleId))! };
}
