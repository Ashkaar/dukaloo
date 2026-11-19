import { DashboardHome, type Subscription } from "@/components/dashboard-home";
import { requireSectionPage } from "@/lib/pageAccess";
import { dayStart, nextDay } from "@/lib/format";
import { listSales } from "@/lib/salesDb";
import { requestToday } from "@/lib/settingsDb";
import { accountUrl, currentShop } from "@/lib/tenant";

export default async function DashboardPage() {
  const { viewer } = await requireSectionPage("dashboard");
  const shop = await currentShop();
  // Only the owner sees the subscription, and only with many shops.
  const subscription: Subscription | null =
    shop && viewer.kind === "owner"
      ? { state: shop.state, plan: shop.plan, trialEndsAt: shop.trialEndsAt, paidUntil: shop.paidUntil, accountUrl: accountUrl() }
      : null;
  let today: { count: number; totalCents: number } | null = null;
  if (viewer.sections.includes("sales")) {
    const { day, timeZone } = await requestToday();
    const { totals } = await listSales(dayStart(day, timeZone), dayStart(nextDay(day), timeZone));
    today = { count: totals.count, totalCents: totals.totalCents };
  }
  return <DashboardHome viewer={viewer} subscription={subscription} today={today} />;
}
