import { redirect } from "next/navigation";
import { OwnerPasswordForm } from "@/components/owner-password-form";
import { requireViewer } from "@/lib/pageAccess";
import { hasOwnerPassword } from "@/lib/secrets";
import { homeFor } from "@/lib/sections";
import { shopPath } from "@/lib/tenant";

// Choosing (first visit from Ariloo) or changing the owner password.
// Only the owner's own session comes here.
export default async function OwnerPasswordPage() {
  const viewer = await requireViewer();
  if (viewer.kind !== "owner") redirect(await shopPath(homeFor(viewer.sections)));
  return <OwnerPasswordForm hasPassword={await hasOwnerPassword()} />;
}
