import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/pageAccess";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
