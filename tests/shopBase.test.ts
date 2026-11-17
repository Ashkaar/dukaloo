import { describe, expect, it } from "vitest";
import { shopKey, withBase, withoutBase } from "@/lib/shopBase";

describe("shop addresses", () => {
  it("adds the shop's address to app paths only", () => {
    expect(withBase("/api/staff", "/city-market")).toBe("/city-market/api/staff");
    expect(withBase("/city-market/api/staff", "/city-market")).toBe("/city-market/api/staff");
    expect(withBase("https://ariloo.app", "/city-market")).toBe("https://ariloo.app");
    expect(withBase("//evil.example", "/city-market")).toBe("//evil.example");
    expect(withBase("/api/staff", "")).toBe("/api/staff");
  });
  it("removes it again", () => {
    expect(withoutBase("/city-market/dashboard", "/city-market")).toBe("/dashboard");
    expect(withoutBase("/city-market", "/city-market")).toBe("/");
  });
  it("keeps each shop's saved data apart", () => {
    expect(shopKey("outbox", "/city-market")).toBe("outbox:city-market");
    expect(shopKey("outbox", "")).toBe("outbox");
  });
});
