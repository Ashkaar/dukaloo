import { SalesList, type DayOfSales } from "@/components/sales/sales-list";
import { dayStart, nextDay } from "@/lib/format";
import { requireSectionPage } from "@/lib/pageAccess";
import { listSales } from "@/lib/salesDb";
import { getSalesSettings, requestToday } from "@/lib/settingsDb";

export default async function SalesPage() {
  const { viewer } = await requireSectionPage("sales");
  const { day, timeZone } = await requestToday();
  const [list, settings] = await Promise.all([listSales(dayStart(day, timeZone), dayStart(nextDay(day), timeZone)), getSalesSettings()]);
  const first: DayOfSales = { day, ...list };
  return <SalesList first={first} today={day} settings={settings} canVoid={viewer.isOwner} />;
}
