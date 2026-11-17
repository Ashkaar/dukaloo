import { SECTIONS, type Section } from "./sections";
import type { PlanId } from "./shopState";

// What each Ariloo plan opens. This is the ONE place plans are mapped to
// sections: getViewer() (lib/access.ts) only ever returns sections in the
// shop's plan, so the navigation, the pages and the API all follow it.
//
// A trial has every feature (tenant.ts treats it as "advanced"). The split
// between starter, pro and advanced isn't decided yet, so every plan opens
// everything for now. Dashboard, Staff and Settings must stay in every plan.

export const PLAN_SECTIONS: Record<PlanId, readonly Section[]> = {
  starter: SECTIONS,
  pro: SECTIONS,
  advanced: SECTIONS,
};

// null plan (single-shop mode) → everything.
export function sectionsInPlan(plan: PlanId | null, singleShop: boolean): readonly Section[] {
  if (singleShop) return SECTIONS;
  return plan ? PLAN_SECTIONS[plan] : [];
}
