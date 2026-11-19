import "server-only";
import { featuresInPlan, sectionsInPlan, type Feature } from "./plans";
import type { Section } from "./sections";
import { currentShop, multiShop } from "./tenant";

// The optional features this shop's plan includes (credit sales, scale barcodes).
export async function shopFeatures(): Promise<readonly Feature[]> {
  const shop = await currentShop();
  return featuresInPlan(shop?.plan ?? null, !multiShop());
}

// Whether the shop's plan includes a section at all (whoever is signed in):
// e.g. the till offers customers only on plans that have Customers.
export async function planIncludes(section: Section): Promise<boolean> {
  const shop = await currentShop();
  return sectionsInPlan(shop?.plan ?? null, !multiShop()).includes(section);
}
