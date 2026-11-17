import { describe, expect, it } from "vitest";
import { GRACE_MS, isOpenState, isShopSlug, shopStateOf } from "@/lib/shopState";

const now = Date.UTC(2026, 10, 17);
const day = 24 * 60 * 60_000;
const state = (fields: Partial<{ suspended: boolean; paidUntil: number | null; trialEndsAt: number | null }>) =>
  shopStateOf({ suspended: false, paidUntil: null, trialEndsAt: null, ...fields }, now);

describe("shopStateOf", () => {
  it("suspended wins over everything", () => {
    expect(state({ suspended: true, paidUntil: now + day, trialEndsAt: now + day })).toBe("suspended");
  });
  it("paid until the future is active", () => {
    expect(state({ paidUntil: now + 1 })).toBe("active");
  });
  it("paid until less than 5 days ago is grace", () => {
    expect(state({ paidUntil: now - day })).toBe("grace");
    expect(state({ paidUntil: now - GRACE_MS + 1 })).toBe("grace");
  });
  it("paid until 5 or more days ago with no trial is expired", () => {
    expect(state({ paidUntil: now - GRACE_MS })).toBe("expired");
  });
  it("a lapsed payment falls back to a running trial", () => {
    expect(state({ paidUntil: now - 10 * day, trialEndsAt: now + day })).toBe("trial");
  });
  it("a trial in the future is trial; a past one is expired", () => {
    expect(state({ trialEndsAt: now + day })).toBe("trial");
    expect(state({ trialEndsAt: now - day })).toBe("expired");
  });
  it("both empty is waiting", () => {
    expect(state({})).toBe("waiting");
  });
  it("is open only in trial, active and grace", () => {
    expect(["trial", "active", "grace"].every((s) => isOpenState(s as never))).toBe(true);
    expect(["waiting", "expired", "suspended"].some((s) => isOpenState(s as never))).toBe(false);
  });
});

describe("isShopSlug", () => {
  it("accepts Ariloo addresses and refuses others", () => {
    expect(isShopSlug("city-market")).toBe(true);
    expect(isShopSlug("a1b")).toBe(true);
    expect(isShopSlug("ab")).toBe(false);
    expect(isShopSlug("-abc")).toBe(false);
    expect(isShopSlug("abc-")).toBe(false);
    expect(isShopSlug("City")).toBe(false);
    expect(isShopSlug("a".repeat(31))).toBe(false);
  });
});
