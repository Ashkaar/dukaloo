import { SettingsScreen, type ShopFacts } from "@/components/settings-screen";
import { requireSectionPage } from "@/lib/pageAccess";
import { shopFeatures } from "@/lib/features";
import { getSalesSettings } from "@/lib/settingsDb";
import { accountUrl, currentShop, profileOf } from "@/lib/tenant";

export default async function SettingsPage() {
  const { viewer } = await requireSectionPage("settings");
  const shop = await currentShop();
  const profile = profileOf(shop);
  const facts: ShopFacts = {
    name: profile.name,
    branch: profile.branch,
    currency: profile.currency,
    plan: shop ? shop.plan : null,
    state: shop ? shop.state : null,
    accountUrl: shop ? accountUrl() : null,
  };
  const [selling, features] = await Promise.all([getSalesSettings(), shopFeatures()]);
  return <SettingsScreen viewer={viewer} shop={facts} selling={selling} features={features} />;
}
