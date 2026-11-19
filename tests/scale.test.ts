import { describe, expect, it } from "vitest";
import { ean13CheckDigit } from "@/lib/catalog";
import { normaliseSalesSettings, salesSettingsSchema } from "@/lib/sale";
import { DEFAULT_SCALE, itemCodeKeys, labelQuantity, normaliseScale, parseScaleLabel, parseScaleReading } from "@/lib/scale";

const on = { ...DEFAULT_SCALE, enabled: true };
const label = (first12: string) => `${first12}${ean13CheckDigit(first12)}`;

describe("scale labels", () => {
  it("read weight and price labels", () => {
    expect(parseScaleLabel(label("210012301250"), on, 0)).toEqual({ itemCode: "00123", kind: "weight", grams: 1250 });
    expect(parseScaleLabel(label("220012304500"), on, 0)).toEqual({ itemCode: "00123", kind: "price", cents: 450000 });
    expect(parseScaleLabel(label("220012304500"), on, 2)).toEqual({ itemCode: "00123", kind: "price", cents: 4500 });
  });
  it("ignore other codes, bad check digits and a scale that is off", () => {
    expect(parseScaleLabel(label("200000000001"), on, 0)).toBeNull();
    expect(parseScaleLabel("2100123012500", on, 0)).toBeNull();
    expect(parseScaleLabel(label("210012301250"), DEFAULT_SCALE, 0)).toBeNull();
    expect(parseScaleLabel(label("210012300000"), on, 0)).toBeNull();
    expect(parseScaleLabel(label("220012304500"), { ...on, pricePrefix: "" }, 0)).toBeNull();
  });
  it("match item codes with or without leading zeros", () => {
    expect(itemCodeKeys("00123")).toEqual(["00123", "123"]);
    expect(itemCodeKeys("12345")).toEqual(["12345"]);
  });
  it("turn a label into a quantity", () => {
    expect(labelQuantity({ itemCode: "1", kind: "weight", grams: 1250 }, "kg", 0)).toBe(1250);
    expect(labelQuantity({ itemCode: "1", kind: "weight", grams: 250 }, "g", 0)).toBe(250_000);
    // 4,500 at 3,000 a kilo is 1.5 kg.
    expect(labelQuantity({ itemCode: "1", kind: "price", cents: 450000 }, "kg", 300000)).toBe(1500);
    expect(labelQuantity({ itemCode: "1", kind: "price", cents: 450000 }, "kg", 0)).toBeNull();
  });
});

describe("scale readings", () => {
  it("read common scale outputs as grams", () => {
    expect(parseScaleReading("ST,GS,+  1.234kg")).toBe(1234);
    expect(parseScaleReading("  0.750 kg")).toBe(750);
    expect(parseScaleReading("1234 g")).toBe(1234);
    expect(parseScaleReading("2,5")).toBe(2500);
    expect(parseScaleReading("US,GS,+  0.000kg")).toBeNull();
    expect(parseScaleReading("")).toBeNull();
  });
});

describe("scale settings", () => {
  it("default off, and fix bad saved values", () => {
    expect(normaliseSalesSettings(undefined).scale).toEqual(DEFAULT_SCALE);
    expect(normaliseScale({ enabled: true, weightPrefix: "20", pricePrefix: "22", baudRate: 1 })).toEqual({ enabled: true, weightPrefix: "21", pricePrefix: "22", baudRate: 9600 });
    expect(normaliseScale({ weightPrefix: "22", pricePrefix: "22" }).weightPrefix).toBe("");
  });
  it("refuse prefix 20 and the same prefix twice", () => {
    const base = { allowNegativeStock: true, tax: { enabled: false, name: "", rateBp: 0, inclusive: true }, receipt: { header: "", footer: "", paper: "80" } };
    expect(salesSettingsSchema.safeParse({ ...base, scale: { ...on } }).success).toBe(true);
    expect(salesSettingsSchema.safeParse({ ...base, scale: { ...on, weightPrefix: "20" } }).success).toBe(false);
    expect(salesSettingsSchema.safeParse({ ...base, scale: { ...on, pricePrefix: "21" } }).success).toBe(false);
    expect(salesSettingsSchema.safeParse(base).success).toBe(true);
  });
});
