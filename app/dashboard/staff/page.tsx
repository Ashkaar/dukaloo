import { StaffManager } from "@/components/staff-manager";
import { UnlockGate } from "@/components/unlock-gate";
import { requireSectionPage } from "@/lib/pageAccess";
import { listStaff } from "@/lib/staffDb";

export default async function StaffPage() {
  const { locked } = await requireSectionPage("staff");
  if (locked) return <UnlockGate />;
  return <StaffManager initial={await listStaff()} />;
}
