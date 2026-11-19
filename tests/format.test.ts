import { describe, expect, it } from "vitest";
import { clockIn, formatDate, formatDateTime, formatMoney, formatQuantity, parseMoney, parseQuantity, toLatinDigits } from "@/lib/format";

const strip = (s: string) => s.replace(/[⁦-⁩]/g, "");

describe("money", () => {
  it("parses typed amounts into cents", () => {
    expect(parseMoney("12.5", 2)).toBe(1250);
    expect(parseMoney("1,250", 0)).toBe(125000);
    expect(parseMoney("0.01", 2)).toBe(1);
    expect(parseMoney("١٢٫٥", 2)).toBe(1250);
  });
  it("refuses junk and too many decimals", () => {
    expect(parseMoney("abc", 2)).toBeNull();
    expect(parseMoney("1.234", 2)).toBeNull();
    expect(parseMoney("1.5", 0)).toBeNull();
    expect(parseMoney("-5", 2)).toBeNull();
  });
  it("formats the same way everywhere", () => {
    expect(strip(formatMoney(125000, { currency: "IQD", decimals: 0 }))).toBe("1,250 IQD");
    expect(strip(formatMoney(1250, { currency: "USD", decimals: 2 }))).toBe("$12.50");
    expect(strip(formatMoney(-5, { currency: "USD", decimals: 2 }))).toBe("-$0.05");
    expect(strip(formatMoney(123456789, { currency: "TRY", decimals: 2 }))).toBe("₺1,234,567.89");
  });
});

describe("quantities", () => {
  it("are thousandths", () => {
    expect(parseQuantity("1")).toBe(1000);
    expect(parseQuantity("0.25")).toBe(250);
    expect(parseQuantity("2,5")).toBe(2500);
    expect(parseQuantity("1.2345")).toBeNull();
    expect(formatQuantity(2500)).toBe("2.5");
    expect(formatQuantity(1234000)).toBe("1,234");
    expect(formatQuantity(-250)).toBe("-0.25");
  });
  it("normalises Eastern Arabic and Persian digits", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });
});

describe("dates", () => {
  // 2026-11-17 22:30 UTC is already the 18th in Baghdad (UTC+3).
  const ms = Date.UTC(2026, 10, 17, 22, 30);
  it("use the shop's time zone, not the device's", () => {
    expect(clockIn(ms, "Asia/Baghdad")).toEqual({ year: 2026, month: 11, day: 18, hour: 1, minute: 30 });
    expect(formatDate(ms, "en", "UTC")).toBe("17 Nov 2026");
  });
  it("name months in each language", () => {
    expect(formatDateTime(ms, "en", "Asia/Baghdad")).toBe("18 Nov 2026, 01:30");
    expect(formatDate(ms, "ku", "Asia/Baghdad")).toBe("18 تشرینی دووەم 2026");
    expect(formatDate(ms, "tr", "Asia/Baghdad")).toBe("18 Kas 2026");
  });
});

describe("days in a time zone", () => {
  it("start at local midnight", async () => {
    const { dayStart, dayOf, nextDay } = await import("@/lib/format");
    expect(new Date(dayStart("2026-11-18", "Asia/Baghdad")).toISOString()).toBe("2026-11-17T21:00:00.000Z");
    expect(new Date(dayStart("2026-11-18", "UTC")).toISOString()).toBe("2026-11-18T00:00:00.000Z");
    // Across a clock change (London, 29 March 2026).
    expect(new Date(dayStart("2026-03-30", "Europe/London")).toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(dayOf(Date.UTC(2026, 10, 17, 22, 30), "Asia/Baghdad")).toBe("2026-11-18");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});
