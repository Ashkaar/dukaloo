import { z } from "zod";

// Products, variants and categories: shared types, limits and validation
// (client and server). Server-only queries are in lib/catalogDb.ts.
//
// Every product has at least one variant, and only variants are sold,
// counted and labelled. A product without options (size, colour…) has a
// single variant with no option values. Money is integer cents; stock
// thresholds are integer thousandths.

// Units are built into the app (translated under `units` in lib/i18n), so a
// new shop has nothing to set up. Weighed and measured units allow parts of
// a unit (0.25 kg); the others are whole numbers only.
export const UNITS = ["piece", "pack", "box", "pair", "set", "kg", "g", "l", "ml", "m", "cm"] as const;
export type Unit = (typeof UNITS)[number];
export const DECIMAL_UNITS: readonly Unit[] = ["kg", "g", "l", "ml", "m", "cm"];

export const LIMITS = {
  name: 120,
  brand: 60,
  description: 1000,
  category: 60,
  optionName: 30,
  optionValue: 40,
  options: 3,
  valuesPerOption: 40,
  variants: 300,
  sku: 40,
  barcode: 32,
  // 100 billion in the shop's currency, in cents.
  money: 10_000_000_000_000,
  // One million units, in thousandths.
  quantity: 1_000_000_000,
} as const;

export interface Category {
  id: number;
  name: string;
  productCount: number;
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface Variant {
  id: number;
  // One value per product option, in the same order ([] without options).
  options: string[];
  sku: string;
  barcode: string;
  priceCents: number;
  costCents: number;
  // Warn when stock falls to this (thousandths); 0 = no warning.
  lowStockMilli: number;
  active: boolean;
}

export interface Product {
  id: number;
  name: string;
  categoryId: number | null;
  brand: string;
  description: string;
  unit: Unit;
  options: ProductOption[];
  variants: Variant[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

// A row in the products list: enough to show and search, without every variant field.
export interface ProductSummary {
  id: number;
  name: string;
  categoryId: number | null;
  brand: string;
  unit: Unit;
  active: boolean;
  variantCount: number;
  minPriceCents: number;
  maxPriceCents: number;
  // The barcode or SKU of a single-variant product, else "".
  code: string;
  updatedAt: number;
}

export const variantLabel = (v: Pick<Variant, "options">) => v.options.join(" / ");

// ---- Barcodes -------------------------------------------------------------

// Printable characters a Code 128 label and a USB scanner both handle.
export const BARCODE_PATTERN = /^[0-9A-Za-z\-._/+]{1,32}$/;

export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

// Barcodes the shop makes for its own products: EAN-13 starting with "2",
// the range set aside for use inside a store, so they never clash with a
// manufacturer's code. `n` is the shop's running number.
export function internalBarcode(n: number): string {
  const body = `2${String(n).padStart(11, "0")}`.slice(0, 12);
  return `${body}${ean13CheckDigit(body)}`;
}

// The symbology a label uses for a code.
export function barcodeType(code: string): "ean13" | "ean8" | "upca" | "code128" {
  if (isValidEan13(code)) return "ean13";
  if (/^\d{8}$/.test(code)) return "ean8";
  if (/^\d{12}$/.test(code)) return "upca";
  return "code128";
}

// ---- Validation -----------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);
const money = z.number().int().min(0).max(LIMITS.money);

export const categorySchema = z.object({ name: text(LIMITS.category).min(1) });

const variantInput = z.object({
  // Present when editing an existing variant.
  id: z.number().int().positive().optional(),
  options: z.array(text(LIMITS.optionValue).min(1)).max(LIMITS.options),
  sku: text(LIMITS.sku),
  barcode: z
    .string()
    .trim()
    .max(LIMITS.barcode)
    .refine((v) => v === "" || BARCODE_PATTERN.test(v)),
  priceCents: money,
  costCents: money,
  lowStockMilli: z.number().int().min(0).max(LIMITS.quantity),
  active: z.boolean(),
});
export type VariantInput = z.infer<typeof variantInput>;

const optionInput = z.object({
  name: text(LIMITS.optionName).min(1),
  values: z.array(text(LIMITS.optionValue).min(1)).min(1).max(LIMITS.valuesPerOption),
});

export const productSchema = z
  .object({
    name: text(LIMITS.name).min(1),
    categoryId: z.number().int().positive().nullable(),
    brand: text(LIMITS.brand),
    description: text(LIMITS.description),
    unit: z.enum(UNITS),
    active: z.boolean(),
    options: z.array(optionInput).max(LIMITS.options),
    variants: z.array(variantInput).min(1).max(LIMITS.variants),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const lower = (s: string) => s.toLocaleLowerCase();
    if (new Set(p.options.map((o) => lower(o.name))).size !== p.options.length) issue("duplicate option name");
    for (const o of p.options) if (new Set(o.values.map(lower)).size !== o.values.length) issue("duplicate option value");
    if (p.options.length === 0 && p.variants.length !== 1) issue("a product without options has exactly one variant");
    const combos = new Set<string>();
    for (const v of p.variants) {
      if (v.options.length !== p.options.length) issue("variant options don't match");
      v.options.forEach((value, i) => {
        if (p.options[i] && !p.options[i].values.some((x) => lower(x) === lower(value))) issue("unknown option value");
      });
      const key = v.options.map(lower).join("\u0000");
      if (combos.has(key)) issue("duplicate variant");
      combos.add(key);
    }
    const barcodes = p.variants.map((v) => v.barcode).filter(Boolean);
    if (new Set(barcodes).size !== barcodes.length) issue("duplicate barcode");
    const skus = p.variants.map((v) => lower(v.sku)).filter(Boolean);
    if (new Set(skus).size !== skus.length) issue("duplicate sku");
  });
export type ProductInput = z.infer<typeof productSchema>;

// Every combination of the options' values, in order: Size × Colour →
// [S, Red], [S, Blue], [M, Red]…
export function combinations(options: ProductOption[]): string[][] {
  return options.reduce<string[][]>((acc, o) => acc.flatMap((combo) => o.values.map((v) => [...combo, v])), [[]]);
}
