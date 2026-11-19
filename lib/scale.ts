import { isValidEan13 } from "./catalog";

// Items sold by weight. Two ways in:
//
// 1. Labels printed by a shop scale: EAN-13 codes "PP IIIII VVVVV C" — a
//    two-digit prefix, the item's five-digit code (matched to a variant's SKU
//    or barcode), a five-digit value and the check digit. The value is the
//    weight in grams (weight prefix) or the price (price prefix: whole units
//    in a shop without decimals, else hundredths).
// 2. A scale on the till's USB or serial port (Web Serial), read in the
//    quantity dialog.
//
// "20" is not offered: Dukaloo's own barcodes start with it.

export const SCALE_PREFIXES = ["02", "21", "22", "23", "24", "25", "26", "27", "28", "29"] as const;
export const BAUD_RATES = [2400, 4800, 9600, 19200] as const;

export interface ScaleSettings {
  enabled: boolean;
  // "" = labels of that kind aren't used.
  weightPrefix: string;
  pricePrefix: string;
  baudRate: number;
}

export const DEFAULT_SCALE: ScaleSettings = { enabled: false, weightPrefix: "21", pricePrefix: "22", baudRate: 9600 };

export function normaliseScale(raw: unknown): ScaleSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const prefix = (v: unknown, d: string) => (v === "" || (SCALE_PREFIXES as readonly string[]).includes(String(v)) ? String(v) : d);
  let weightPrefix = prefix(r.weightPrefix, DEFAULT_SCALE.weightPrefix);
  const pricePrefix = prefix(r.pricePrefix, DEFAULT_SCALE.pricePrefix);
  if (weightPrefix && weightPrefix === pricePrefix) weightPrefix = "";
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_SCALE.enabled,
    weightPrefix,
    pricePrefix,
    baudRate: (BAUD_RATES as readonly number[]).includes(Number(r.baudRate)) ? Number(r.baudRate) : DEFAULT_SCALE.baudRate,
  };
}

export type ScaleLabel = { itemCode: string; kind: "weight"; grams: number } | { itemCode: string; kind: "price"; cents: number };

// Reads a scale label, or null if the code isn't one.
export function parseScaleLabel(code: string, s: ScaleSettings, decimals: 0 | 2): ScaleLabel | null {
  if (!s.enabled || !isValidEan13(code)) return null;
  const prefix = code.slice(0, 2);
  const itemCode = code.slice(2, 7);
  const value = Number(code.slice(7, 12));
  if (s.weightPrefix && prefix === s.weightPrefix) return value > 0 ? { itemCode, kind: "weight", grams: value } : null;
  if (s.pricePrefix && prefix === s.pricePrefix) return value > 0 ? { itemCode, kind: "price", cents: decimals === 0 ? value * 100 : value } : null;
  return null;
}

// The codes an item may carry for a label's item code: "00123" also as "123".
export function itemCodeKeys(itemCode: string): string[] {
  const short = itemCode.replace(/^0+/, "");
  return short && short !== itemCode ? [itemCode, short] : [itemCode];
}

// The quantity (thousandths of the item's unit) a label stands for.
export function labelQuantity(label: ScaleLabel, unit: string, unitPriceCents: number): number | null {
  if (label.kind === "weight") return unit === "g" ? label.grams * 1000 : label.grams;
  if (unitPriceCents <= 0) return null;
  return Math.max(1, Math.round((label.cents * 1000) / unitPriceCents));
}

// A reading sent by a scale ("ST,GS,+  1.234kg", "  0.750 kg", "1234 g"):
// the last weight in the text, as grams. Unmarked numbers are kilograms.
export function parseScaleReading(text: string): number | null {
  const all = [...text.matchAll(/([-+]?\s*\d+(?:[.,]\d+)?)\s*(kg|g|lb)?/gi)];
  for (let i = all.length - 1; i >= 0; i--) {
    const n = Number(all[i][1].replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) continue;
    const unit = (all[i][2] ?? "kg").toLowerCase();
    const grams = unit === "g" ? n : unit === "lb" ? n * 453.59237 : n * 1000;
    return Math.round(grams);
  }
  return null;
}
