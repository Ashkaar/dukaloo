// A shop's subscription state, worked out from its row in Ariloo's
// ariloo_shops table. Pure functions, safe anywhere (and unit tested).

export type PlanId = "starter" | "pro" | "advanced";
export type ShopState = "waiting" | "trial" | "active" | "grace" | "expired" | "suspended";

export const GRACE_MS = 5 * 24 * 60 * 60_000;

export interface SubscriptionFields {
  suspended: boolean;
  // Milliseconds, or null when empty.
  paidUntil: number | null;
  trialEndsAt: number | null;
}

// In this order: suspended; paid until a future time → active; paid until
// less than 5 days ago → grace; else a trial ending in the future → trial;
// both empty → waiting (not open yet); otherwise expired.
export function shopStateOf(fields: SubscriptionFields, now: number): ShopState {
  if (fields.suspended) return "suspended";
  const { paidUntil, trialEndsAt } = fields;
  if (paidUntil != null && paidUntil > now) return "active";
  if (paidUntil != null && paidUntil + GRACE_MS > now) return "grace";
  if (trialEndsAt != null && trialEndsAt > now) return "trial";
  if (paidUntil == null && trialEndsAt == null) return "waiting";
  return "expired";
}

export const isOpenState = (state: ShopState): boolean => state === "trial" || state === "active" || state === "grace";

// A shop address, as Ariloo's setup wizard accepts it.
export const isShopSlug = (value: string): boolean => /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(value);
