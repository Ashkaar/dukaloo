import { describe, expect, it } from "vitest";
import { effectiveTimeZone, isTimeZone, normaliseSetting } from "@/lib/timeZone";

describe("time zones", () => {
  it("recognises real zones only", () => {
    expect(isTimeZone("Asia/Baghdad")).toBe(true);
    expect(isTimeZone("Europe/Istanbul")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("Asia/Baghdad; drop table")).toBe(false);
    expect(isTimeZone(42)).toBe(false);
  });
  it("defaults to each device's zone", () => {
    expect(normaliseSetting(undefined)).toBe("device");
    expect(normaliseSetting("nonsense")).toBe("device");
    expect(normaliseSetting("Asia/Tehran")).toBe("Asia/Tehran");
  });
  it("uses the shop's zone, else the device's, else Baghdad", () => {
    expect(effectiveTimeZone("Europe/Istanbul", "Asia/Dubai")).toBe("Europe/Istanbul");
    expect(effectiveTimeZone("device", "Asia/Dubai")).toBe("Asia/Dubai");
    expect(effectiveTimeZone("device", undefined)).toBe("Asia/Baghdad");
    expect(effectiveTimeZone("device", "Bad/Zone")).toBe("Asia/Baghdad");
  });
});
