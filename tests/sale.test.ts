import { describe, expect, it } from "vitest";
import { computeTotals, DEFAULT_SALES_SETTINGS, newSaleSchema, normaliseSalesSettings, settle } from "@/lib/sale";

const noTax = DEFAULT_SALES_SETTINGS.tax;
const vat = (rateBp: number, inclusive: boolean) => ({ enabled: true, name: "VAT", rateBp, inclusive });

describe("computeTotals", () => {
  it("adds lines with quantities in thousandths", () => {
    const t = computeTotals([{ unitPriceCents: 1250, qtyMilli: 2000, discountCents: 0 }, { unitPriceCents: 400, qtyMilli: 250, discountCents: 0 }], null, noTax, 2);
    expect(t.lines.map((l) => l.netCents)).toEqual([2500, 100]);
    expect(t.totalCents).toBe(2600);
  });
  it("applies line and sale discounts, never below zero", () => {
    const t = computeTotals([{ unitPriceCents: 1000, qtyMilli: 1000, discountCents: 300 }], { kind: "amount", cents: 99999 }, noTax, 2);
    expect(t.subtotalCents).toBe(700);
    expect(t.discountCents).toBe(700);
    expect(t.totalCents).toBe(0);
    const p = computeTotals([{ unitPriceCents: 1000, qtyMilli: 3000, discountCents: 0 }], { kind: "percent", bp: 1000 }, noTax, 2);
    expect(p.discountCents).toBe(300);
    expect(p.totalCents).toBe(2700);
  });
  it("adds tax on top when prices exclude it", () => {
    const t = computeTotals([{ unitPriceCents: 10000, qtyMilli: 1000, discountCents: 0 }], null, vat(1500, false), 2);
    expect(t.taxCents).toBe(1500);
    expect(t.totalCents).toBe(11500);
  });
  it("shows the tax inside the price when prices include it", () => {
    const t = computeTotals([{ unitPriceCents: 11500, qtyMilli: 1000, discountCents: 0 }], null, vat(1500, true), 2);
    expect(t.taxCents).toBe(1500);
    expect(t.totalCents).toBe(11500);
  });
  it("rounds to whole units in a shop without decimals", () => {
    // 0.333 kg at 1,000 IQD = 333 IQD; 5% tax on top = 16.65 → 17 IQD.
    const t = computeTotals([{ unitPriceCents: 100000, qtyMilli: 333, discountCents: 0 }], null, vat(500, false), 0);
    expect(t.lines[0].netCents).toBe(33300);
    expect(t.taxCents).toBe(1700);
    expect(t.totalCents % 100).toBe(0);
  });
  it("ignores tax when it is off", () => {
    expect(computeTotals([{ unitPriceCents: 1000, qtyMilli: 1000, discountCents: 0 }], null, { ...vat(1500, false), enabled: false }, 2).totalCents).toBe(1000);
  });
});

describe("settle", () => {
  it("gives change from cash only", () => {
    expect(settle(1000, [{ method: "cash", cents: 2000 }])).toEqual({ paidCents: 2000, changeCents: 1000 });
    expect(settle(1000, [{ method: "card", cents: 600 }, { method: "cash", cents: 500 }])).toEqual({ paidCents: 1100, changeCents: 100 });
  });
  it("refuses short payments and card over the total", () => {
    expect(settle(1000, [{ method: "cash", cents: 999 }])).toBeNull();
    expect(settle(1000, [{ method: "card", cents: 1500 }])).toBeNull();
    expect(settle(1000, [{ method: "transfer", cents: 400 }, { method: "card", cents: 700 }])).toBeNull();
  });
});

describe("settings and input", () => {
  it("fill in defaults for old or broken saved values", () => {
    expect(normaliseSalesSettings(undefined)).toEqual(DEFAULT_SALES_SETTINGS);
    const s = normaliseSalesSettings({ allowNegativeStock: false, tax: { rateBp: -5, enabled: true }, receipt: { paper: "99" } });
    expect(s.allowNegativeStock).toBe(false);
    expect(s.tax).toEqual({ ...DEFAULT_SALES_SETTINGS.tax, enabled: true });
    expect(s.receipt.paper).toBe("80");
  });
  it("refuse odd sales from the browser", () => {
    const ok = { clientId: "abcdef12", lines: [{ variantId: 1, qtyMilli: 1000, discountCents: 0 }], discount: null, payments: [{ method: "cash", cents: 100 }], note: "", expectedTotalCents: 100 };
    expect(newSaleSchema.safeParse(ok).success).toBe(true);
    expect(newSaleSchema.safeParse({ ...ok, lines: [] }).success).toBe(false);
    expect(newSaleSchema.safeParse({ ...ok, lines: [{ variantId: 1, qtyMilli: 0.5, discountCents: 0 }] }).success).toBe(false);
    expect(newSaleSchema.safeParse({ ...ok, payments: [{ method: "cheque", cents: 100 }] }).success).toBe(false);
    expect(newSaleSchema.safeParse({ ...ok, clientId: "x" }).success).toBe(false);
  });
});

describe("refundFor", () => {
  it("refunds a line's share of what was paid", async () => {
    const { refundFor } = await import("@/lib/sale");
    // 2 items at 1,000 and 1 at 2,000; 10% off the sale; total 3,600.
    const sale = { subtotalCents: 400000, totalCents: 360000 };
    expect(refundFor(sale, { qtyMilli: 2000, totalCents: 200000 }, 1000, 0)).toBe(90000);
    expect(refundFor(sale, { qtyMilli: 1000, totalCents: 200000 }, 1000, 0)).toBe(180000);
    // Tax added at the till is refunded too: 100 + 15%.
    expect(refundFor({ subtotalCents: 10000, totalCents: 11500 }, { qtyMilli: 1000, totalCents: 10000 }, 1000, 2)).toBe(11500);
    // Never more than the line.
    expect(refundFor(sale, { qtyMilli: 1000, totalCents: 200000 }, 5000, 0)).toBe(180000);
  });
});

describe("sales on account", () => {
  it("settle a sale put fully or partly on account, never giving change from it", () => {
    expect(settle(1000, [{ method: "credit", cents: 1000 }])).toEqual({ paidCents: 1000, changeCents: 0 });
    expect(settle(1000, [{ method: "cash", cents: 400 }, { method: "credit", cents: 600 }])).toEqual({ paidCents: 1000, changeCents: 0 });
    expect(settle(1000, [{ method: "credit", cents: 1200 }])).toBeNull();
    expect(settle(1000, [{ method: "credit", cents: 500 }])).toBeNull();
  });
  it("is off unless turned on, and the till may send it", () => {
    expect(DEFAULT_SALES_SETTINGS.creditSales).toBe(false);
    expect(normaliseSalesSettings({ creditSales: true }).creditSales).toBe(true);
    expect(normaliseSalesSettings({ creditSales: "yes" }).creditSales).toBe(false);
    const sale = { clientId: "abcdef12", lines: [{ variantId: 1, qtyMilli: 1000, discountCents: 0 }], discount: null, payments: [{ method: "credit", cents: 100 }], note: "", customerId: 3, expectedTotalCents: 100 };
    expect(newSaleSchema.safeParse(sale).success).toBe(true);
  });
});
