import { z } from "zod";

// Selling: shared types, settings and the ONE function that works out a
// sale's totals. The till uses it to show the cart; the server uses it to
// record the sale from the database's prices, never the browser's.
//
// Money is integer cents, quantities integer thousandths, rates integer
// basis points (15% = 1500). In a shop without decimals (IQD) every amount
// is rounded to whole units, so nothing ever shows a fraction.

// Ways money changes hands (also for expenses and customer repayments).
export const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
// Ways a sale can be paid: money, or "credit" (on the customer's account, to
// pay later) when the shop has credit sales turned on.
export const SALE_METHODS = [...PAYMENT_METHODS, "credit"] as const;
export type SaleMethod = (typeof SALE_METHODS)[number];
export const emptyByMethod = (): Record<SaleMethod, number> => ({ cash: 0, card: 0, transfer: 0, credit: 0 });

// ---- Settings (owner, in Settings → Selling) ---------------------------------

export interface SalesSettings {
  // Sell even when stock shows zero or less (warn only). On by default: a new
  // shop has no stock entered yet.
  allowNegativeStock: boolean;
  // Let a customer take goods now and pay later ("on account"). Off by
  // default; needs a plan with credit sales.
  creditSales: boolean;
  tax: {
    enabled: boolean;
    name: string;
    // Basis points: 15% = 1500.
    rateBp: number;
    // Shelf prices already include the tax (it is shown as "of which"),
    // rather than being added at the till.
    inclusive: boolean;
  };
  receipt: {
    header: string;
    footer: string;
    paper: "58" | "80";
  };
}

export const DEFAULT_SALES_SETTINGS: SalesSettings = {
  allowNegativeStock: true,
  creditSales: false,
  tax: { enabled: false, name: "VAT", rateBp: 0, inclusive: true },
  receipt: { header: "", footer: "", paper: "80" },
};

export const salesSettingsSchema = z.object({
  allowNegativeStock: z.boolean(),
  creditSales: z.boolean().default(false),
  tax: z.object({
    enabled: z.boolean(),
    name: z.string().trim().max(20),
    rateBp: z.number().int().min(0).max(10_000),
    inclusive: z.boolean(),
  }),
  receipt: z.object({
    header: z.string().max(300),
    footer: z.string().max(300),
    paper: z.enum(["58", "80"]),
  }),
});

// Old or partial saved values still read as complete settings.
export function normaliseSalesSettings(raw: unknown): SalesSettings {
  const d = DEFAULT_SALES_SETTINGS;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tax = (r.tax && typeof r.tax === "object" ? r.tax : {}) as Record<string, unknown>;
  const receipt = (r.receipt && typeof r.receipt === "object" ? r.receipt : {}) as Record<string, unknown>;
  const merged = {
    allowNegativeStock: typeof r.allowNegativeStock === "boolean" ? r.allowNegativeStock : d.allowNegativeStock,
    creditSales: typeof r.creditSales === "boolean" ? r.creditSales : d.creditSales,
    tax: {
      enabled: typeof tax.enabled === "boolean" ? tax.enabled : d.tax.enabled,
      name: typeof tax.name === "string" && tax.name.trim() ? tax.name.trim().slice(0, 20) : d.tax.name,
      rateBp: Number.isInteger(tax.rateBp) && (tax.rateBp as number) >= 0 && (tax.rateBp as number) <= 10_000 ? (tax.rateBp as number) : d.tax.rateBp,
      inclusive: typeof tax.inclusive === "boolean" ? tax.inclusive : d.tax.inclusive,
    },
    receipt: {
      header: typeof receipt.header === "string" ? receipt.header.slice(0, 300) : d.receipt.header,
      footer: typeof receipt.footer === "string" ? receipt.footer.slice(0, 300) : d.receipt.footer,
      paper: receipt.paper === "58" || receipt.paper === "80" ? receipt.paper : d.receipt.paper,
    },
  };
  return merged;
}

// ---- Totals -----------------------------------------------------------------

export interface LineIn {
  unitPriceCents: number;
  qtyMilli: number;
  // A discount on this line, as an amount.
  discountCents: number;
}

export type SaleDiscount = { kind: "amount"; cents: number } | { kind: "percent"; bp: number };

export interface Totals {
  lines: { grossCents: number; discountCents: number; netCents: number }[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

// Rounds to what the shop can show: hundredths, or whole units with 0 decimals.
export function roundMoney(cents: number, decimals: 0 | 2): number {
  const unit = decimals === 0 ? 100 : 1;
  return Math.round(cents / unit) * unit;
}

export function computeTotals(lines: LineIn[], saleDiscount: SaleDiscount | null, tax: SalesSettings["tax"], decimals: 0 | 2): Totals {
  const out = lines.map((l) => {
    const grossCents = roundMoney((l.unitPriceCents * l.qtyMilli) / 1000, decimals);
    const discountCents = Math.min(Math.max(0, roundMoney(l.discountCents, decimals)), grossCents);
    return { grossCents, discountCents, netCents: grossCents - discountCents };
  });
  const subtotalCents = out.reduce((s, l) => s + l.netCents, 0);
  let discountCents = 0;
  if (saleDiscount?.kind === "amount") discountCents = roundMoney(saleDiscount.cents, decimals);
  if (saleDiscount?.kind === "percent") discountCents = roundMoney((subtotalCents * saleDiscount.bp) / 10_000, decimals);
  discountCents = Math.min(Math.max(0, discountCents), subtotalCents);
  const taxable = subtotalCents - discountCents;
  let taxCents = 0;
  let totalCents = taxable;
  if (tax.enabled && tax.rateBp > 0) {
    if (tax.inclusive) {
      taxCents = roundMoney((taxable * tax.rateBp) / (10_000 + tax.rateBp), decimals);
    } else {
      taxCents = roundMoney((taxable * tax.rateBp) / 10_000, decimals);
      totalCents = taxable + taxCents;
    }
  }
  return { lines: out, subtotalCents, discountCents, taxCents, totalCents };
}

// Payments against a total: non-cash (card, transfer, on account) may not
// exceed it; change comes only from cash. Returns the change, or null when
// the payments don't work.
export function settle(totalCents: number, payments: { method: SaleMethod; cents: number }[]): { paidCents: number; changeCents: number } | null {
  const paidCents = payments.reduce((s, p) => s + p.cents, 0);
  const nonCash = payments.filter((p) => p.method !== "cash").reduce((s, p) => s + p.cents, 0);
  if (payments.some((p) => p.cents < 0)) return null;
  if (paidCents < totalCents || nonCash > totalCents) return null;
  return { paidCents, changeCents: paidCents - totalCents };
}

// ---- What the till sends ----------------------------------------------------

const cents = z.number().int().min(0).max(10_000_000_000_000);

export const newSaleSchema = z.object({
  // Made by the till; a retry with the same id never records the sale twice.
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  lines: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        qtyMilli: z.number().int().min(1).max(1_000_000_000),
        discountCents: cents,
      }),
    )
    .min(1)
    .max(500),
  discount: z.union([z.object({ kind: z.literal("amount"), cents }), z.object({ kind: z.literal("percent"), bp: z.number().int().min(0).max(10_000) })]).nullable(),
  payments: z
    .array(z.object({ method: z.enum(SALE_METHODS), cents }))
    .min(1)
    .max(10),
  note: z.string().trim().max(200),
  // Made while offline and sent later: the customer has paid and gone, so
  // it is recorded even if a price changed or stock shows zero since.
  offline: z.boolean().default(false),
  // The customer the sale is for, if any.
  customerId: z.number().int().positive().nullable().default(null),
  // The total the cashier saw; the server refuses the sale if prices changed since.
  expectedTotalCents: cents,
});
export type NewSale = z.infer<typeof newSaleSchema>;

// ---- A recorded sale ----------------------------------------------------------

export interface SaleLine {
  // The sale line's own id (returns point at it).
  id: number;
  variantId: number;
  name: string;
  variantLabel: string;
  unit: string;
  qtyMilli: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
  // How much of this line has been returned so far.
  returnedMilli: number;
}

export interface SaleReturn {
  id: number;
  at: number;
  staffName: string;
  refundCents: number;
  method: SaleMethod;
  note: string;
  lines: { saleLineId: number; qtyMilli: number; refundCents: number }[];
}

export interface Sale {
  id: number;
  number: number;
  at: number;
  staffName: string;
  customerId: number | null;
  customerName: string;
  // The customer's details now (for an invoice), "" without a customer.
  customerPhone: string;
  customerAddress: string;
  // Recorded on the till while offline, sent later.
  offline: boolean;
  status: "done" | "voided";
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  taxName: string;
  taxRateBp: number;
  taxInclusive: boolean;
  totalCents: number;
  paidCents: number;
  changeCents: number;
  note: string;
  lines: SaleLine[];
  payments: { method: SaleMethod; cents: number }[];
  returns: SaleReturn[];
  // Everything refunded so far.
  refundedCents: number;
}

export interface SaleSummary {
  id: number;
  number: number;
  at: number;
  staffName: string;
  status: "done" | "voided";
  totalCents: number;
  itemCount: number;
  methods: SaleMethod[];
  refundedCents: number;
  offline?: boolean;
}

// A sellable item as the till keeps it in memory.
export interface TillItem {
  variantId: number;
  productId: number;
  name: string;
  variantLabel: string;
  categoryId: number | null;
  unit: string;
  barcode: string;
  sku: string;
  priceCents: number;
  trackStock: boolean;
  stockMilli: number;
}

// ---- Returns ------------------------------------------------------------------

// What returning `qtyMilli` of a sale line gives back: the line's share of
// what the customer actually paid, so a discount on the whole sale, and
// tax added at the till, are refunded in proportion.
export function refundFor(sale: Pick<Sale, "subtotalCents" | "totalCents">, line: Pick<SaleLine, "qtyMilli" | "totalCents">, qtyMilli: number, decimals: 0 | 2): number {
  if (line.qtyMilli <= 0 || sale.subtotalCents <= 0) return 0;
  const lineShare = (line.totalCents * Math.min(qtyMilli, line.qtyMilli)) / line.qtyMilli;
  return roundMoney((lineShare * sale.totalCents) / sale.subtotalCents, decimals);
}

export const newReturnSchema = z.object({
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  lines: z
    .array(z.object({ saleLineId: z.number().int().positive(), qtyMilli: z.number().int().min(1).max(1_000_000_000) }))
    .min(1)
    .max(500),
  // "credit" takes it off what the customer owes.
  method: z.enum(SALE_METHODS),
  note: z.string().trim().max(200),
});
export type NewReturn = z.infer<typeof newReturnSchema>;
