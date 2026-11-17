import { describe, expect, it } from "vitest";
import { barcodeType, combinations, ean13CheckDigit, internalBarcode, isValidEan13, productSchema, type ProductInput } from "@/lib/catalog";

const variant = (options: string[], extra: Partial<ProductInput["variants"][number]> = {}) => ({
  options,
  sku: "",
  barcode: "",
  priceCents: 1000,
  costCents: 600,
  lowStockMilli: 0,
  active: true,
  ...extra,
});
const product = (extra: Partial<ProductInput> = {}): ProductInput => ({
  name: "T-shirt",
  categoryId: null,
  brand: "",
  description: "",
  unit: "piece",
  active: true,
  options: [],
  variants: [variant([])],
  ...extra,
});

describe("barcodes", () => {
  it("computes EAN-13 check digits", () => {
    expect(ean13CheckDigit("400638133393")).toBe(1);
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
  });
  it("makes in-store codes starting with 2", () => {
    const code = internalBarcode(42);
    expect(code).toBe("2000000000428");
    expect(isValidEan13(code)).toBe(true);
  });
  it("picks a symbology", () => {
    expect(barcodeType("4006381333931")).toBe("ean13");
    expect(barcodeType("12345670")).toBe("ean8");
    expect(barcodeType("ABC-123")).toBe("code128");
  });
});

describe("combinations", () => {
  it("multiplies option values in order", () => {
    expect(combinations([{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["Red", "Blue"] }])).toEqual([
      ["S", "Red"],
      ["S", "Blue"],
      ["M", "Red"],
      ["M", "Blue"],
    ]);
    expect(combinations([])).toEqual([[]]);
  });
});

describe("productSchema", () => {
  const sizes = { name: "Size", values: ["S", "M"] };
  it("accepts a simple product and one with variants", () => {
    expect(productSchema.safeParse(product()).success).toBe(true);
    expect(productSchema.safeParse(product({ options: [sizes], variants: [variant(["S"]), variant(["M"])] })).success).toBe(true);
  });
  it("refuses variants that don't match the options", () => {
    expect(productSchema.safeParse(product({ options: [sizes], variants: [variant(["XL"])] })).success).toBe(false);
    expect(productSchema.safeParse(product({ options: [sizes], variants: [variant(["S", "Red"])] })).success).toBe(false);
    expect(productSchema.safeParse(product({ variants: [variant([]), variant([])] })).success).toBe(false);
  });
  it("refuses duplicate combinations, barcodes and SKUs", () => {
    expect(productSchema.safeParse(product({ options: [sizes], variants: [variant(["S"]), variant(["s"])] })).success).toBe(false);
    const sameCode = [variant(["S"], { barcode: "123456" }), variant(["M"], { barcode: "123456" })];
    expect(productSchema.safeParse(product({ options: [sizes], variants: sameCode })).success).toBe(false);
    const sameSku = [variant(["S"], { sku: "TS" }), variant(["M"], { sku: "ts" })];
    expect(productSchema.safeParse(product({ options: [sizes], variants: sameSku })).success).toBe(false);
  });
  it("refuses floats, negative money and odd barcodes", () => {
    expect(productSchema.safeParse(product({ variants: [variant([], { priceCents: 10.5 })] })).success).toBe(false);
    expect(productSchema.safeParse(product({ variants: [variant([], { priceCents: -1 })] })).success).toBe(false);
    expect(productSchema.safeParse(product({ variants: [variant([], { barcode: "12 34" })] })).success).toBe(false);
    expect(productSchema.safeParse(product({ unit: "litre" as never })).success).toBe(false);
  });
});
