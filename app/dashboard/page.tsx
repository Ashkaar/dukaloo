import { DashboardHome, type Subscription } from "@/components/dashboard-home";
import { requireSectionPage } from "@/lib/pageAccess";
import { accountUrl, currentShop } from "@/lib/tenant";

export default async function DashboardPage() {
  const { viewer } = await requireSectionPage("dashboard");
  const shop = await currentShop();
  // Only the owner sees the subscription, and only with many shops.
  const subscription: Subscription | null =
    shop && viewer.kind === "owner"
      ? { state: shop.state, plan: shop.plan, trialEndsAt: shop.trialEndsAt, paidUntil: shop.paidUntil, accountUrl: accountUrl() }
      : null;
  return <DashboardHome viewer={viewer} subscription={subscription} />;
}
