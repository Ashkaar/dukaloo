import { describe, expect, it } from "vitest";
import { featuresInPlan, PLAN_SECTIONS, sectionsInPlan } from "@/lib/plans";
import { SECTIONS } from "@/lib/sections";

describe("plans", () => {
  it("each plan includes the one below it", () => {
    for (const s of PLAN_SECTIONS.starter) expect(PLAN_SECTIONS.pro).toContain(s);
    for (const s of PLAN_SECTIONS.pro) expect(PLAN_SECTIONS.advanced).toContain(s);
    expect([...PLAN_SECTIONS.advanced].sort()).toEqual([...SECTIONS].sort());
  });
  it("always opens dashboard, staff and settings", () => {
    for (const plan of ["starter", "pro", "advanced"] as const) for (const s of ["dashboard", "staff", "settings"] as const) expect(PLAN_SECTIONS[plan]).toContain(s);
  });
  it("gates reports, customers and the optional features", () => {
    expect(PLAN_SECTIONS.starter).not.toContain("reports");
    expect(PLAN_SECTIONS.starter).not.toContain("customers");
    expect(featuresInPlan("starter", false)).toEqual([]);
    expect(featuresInPlan("pro", false)).toContain("credit");
    expect(sectionsInPlan(null, false)).toEqual([]);
    expect(sectionsInPlan(null, true)).toEqual(SECTIONS);
  });
});
