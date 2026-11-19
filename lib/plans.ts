import { SECTIONS, type Section } from "./sections";
import type { PlanId } from "./shopState";

// What each Ariloo plan opens. This is the ONE place plans are mapped to
// sections and features: getViewer() (lib/access.ts) only ever returns
// sections in the shop's plan, and shopFeatures() (lib/features.ts) only
// features in it, so the navigation, the pages and the API all follow.
//
// A trial has everything (tenant.ts treats it as "advanced"). Dashboard,
// Staff and Settings must stay in every plan.
//
// - Starter: run a till: sell, see sales, keep products and expenses.
// - Pro: a shop with regulars and suppliers: customers, purchases, credit
//   sales and scale barcodes.
// - Advanced: the owner's numbers: reports.

const STARTER: readonly Section[] = ["dashboard", "till", "sales", "products", "expenses", "staff", "settings"];
const PRO: readonly Section[] = [...STARTER, "customers", "purchases"];

export const PLAN_SECTIONS: Record<PlanId, readonly Section[]> = {
  starter: STARTER,
  pro: PRO,
  advanced: SECTIONS,
};

// Optional features a shop turns on in Settings, if its plan includes them.
export const FEATURES = ["credit", "scale"] as const;
export type Feature = (typeof FEATURES)[number];

export const PLAN_FEATURES: Record<PlanId, readonly Feature[]> = {
  starter: [],
  pro: ["credit", "scale"],
  advanced: FEATURES,
};

// null plan (single-shop mode) → everything.
export function sectionsInPlan(plan: PlanId | null, singleShop: boolean): readonly Section[] {
  if (singleShop) return SECTIONS;
  return plan ? PLAN_SECTIONS[plan] : [];
}

export function featuresInPlan(plan: PlanId | null, singleShop: boolean): readonly Feature[] {
  if (singleShop) return FEATURES;
  return plan ? PLAN_FEATURES[plan] : [];
}
