import { redirect } from "next/navigation";
import { getViewer } from "@/lib/access";
import { shopUsable } from "@/lib/pageAccess";
import { homeFor } from "@/lib/sections";
import { shopPath } from "@/lib/tenant";

// The shop's own address: straight to the right screen.
export default async function Home() {
  if (!(await shopUsable())) return null;
  const viewer = await getViewer();
  redirect(await shopPath(viewer ? homeFor(viewer.sections) : "/login"));
}
