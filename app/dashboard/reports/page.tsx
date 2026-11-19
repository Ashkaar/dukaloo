import { ReportsScreen } from "@/components/reports/reports-screen";
import { requireSectionPage } from "@/lib/pageAccess";
import { buildReport } from "@/lib/reportsDb";
import { requestToday } from "@/lib/settingsDb";

export default async function ReportsPage() {
  await requireSectionPage("reports");
  const { day, timeZone } = await requestToday();
  const from = `${day.slice(0, 7)}-01`;
  return <ReportsScreen today={day} first={await buildReport(from, day, timeZone)} />;
}
