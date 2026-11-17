import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/access";
import { shopUsable } from "@/lib/pageAccess";
import { hasOwnerPassword } from "@/lib/secrets";
import { homeFor } from "@/lib/sections";
import { listActiveStaffNames } from "@/lib/staffDb";
import { multiShop, shopPath } from "@/lib/tenant";

export default async function LoginPage() {
  if (!(await shopUsable())) return null;
  const viewer = await getViewer();
  if (viewer) redirect(await shopPath(homeFor(viewer.sections)));
  const [staff, ownerSet] = await Promise.all([listActiveStaffNames(), hasOwnerPassword()]);
  const ownerReady = ownerSet || (!multiShop() && Boolean(process.env.OWNER_PASSWORD));
  return <LoginForm staff={staff} ownerReady={ownerReady} />;
}
