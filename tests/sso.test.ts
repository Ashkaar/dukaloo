import { describe, expect, it } from "vitest";
import { checkSsoToken, signSsoToken } from "@/lib/sso";

const secret = "test-secret";
const now = 1_800_000_000_000;
const inSeconds = (s: number) => Math.floor(now / 1000) + s;

describe("checkSsoToken", () => {
  it("accepts a fresh token for the same shop", () => {
    expect(checkSsoToken(signSsoToken("city-market", inSeconds(60), secret), "city-market", secret, now)).toBe(true);
  });
  it("matches Ariloo's format: HMAC-SHA256 hex of sso:<shop>.<expires>", async () => {
    const { createHmac } = await import("crypto");
    const expires = inSeconds(30);
    const token = `v1.city-market.${expires}.${createHmac("sha256", secret).update(`sso:city-market.${expires}`).digest("hex")}`;
    expect(checkSsoToken(token, "city-market", secret, now)).toBe(true);
  });
  it("refuses another shop", () => {
    expect(checkSsoToken(signSsoToken("city-market", inSeconds(60), secret), "other-shop", secret, now)).toBe(false);
  });
  it("refuses an expired token", () => {
    expect(checkSsoToken(signSsoToken("city-market", inSeconds(-1), secret), "city-market", secret, now)).toBe(false);
  });
  it("refuses a token valid for much longer than a minute", () => {
    expect(checkSsoToken(signSsoToken("city-market", inSeconds(600), secret), "city-market", secret, now)).toBe(false);
  });
  it("refuses a wrong signature, a wrong secret and junk", () => {
    const good = signSsoToken("city-market", inSeconds(60), secret);
    expect(checkSsoToken(`${good.slice(0, -1)}0`.replace(/00$/, "01"), "city-market", secret, now)).toBe(false);
    expect(checkSsoToken(good, "city-market", "other", now)).toBe(false);
    expect(checkSsoToken("v1.city-market.abc.def", "city-market", secret, now)).toBe(false);
    expect(checkSsoToken(null, "city-market", secret, now)).toBe(false);
    expect(checkSsoToken(good, "city-market", "", now)).toBe(false);
  });
});
