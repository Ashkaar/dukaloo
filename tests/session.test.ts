import { describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken, SESSION_SECONDS } from "@/lib/session";

describe("session tokens", () => {
  const now = 1_800_000_000_000;
  it("round-trips the owner and staff", () => {
    expect(readSessionToken(createSessionToken("owner", "v1", "k", now), "k", now)).toEqual({ subject: "owner", version: "v1" });
    expect(readSessionToken(createSessionToken(7, "abc", "k", now), "k", now)).toEqual({ subject: 7, version: "abc" });
  });
  it("refuses another shop's key, tampering and expiry", () => {
    const token = createSessionToken("owner", "v1", "k", now);
    expect(readSessionToken(token, "other", now)).toBeNull();
    expect(readSessionToken(token.replace(".owner.", ".1."), "k", now)).toBeNull();
    expect(readSessionToken(token, "k", now + SESSION_SECONDS * 1000 + 1000)).toBeNull();
    expect(readSessionToken(undefined, "k", now)).toBeNull();
  });
});
