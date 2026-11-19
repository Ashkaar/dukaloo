import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { notFound, ok, parseId, requireOwner, serverError } from "@/lib/api";
import { cancelPurchase, getPurchase } from "@/lib/purchasesDb";

type Params = { params: Promise<{ id: string }> };

// POST → cancels a purchase entered by mistake (owner): its stock goes back out.
export async function POST(_request: NextRequest, { params }: Params) {
  const { viewer, error } = await requireOwner();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const actor = viewer.kind === "owner" ? "owner" : viewer.name;
    if (!(await cancelPurchase(id, actor))) return notFound();
    const purchase = await getPurchase(id);
    await logActivity(actor, "purchase-cancelled", `#${purchase?.number ?? id}`);
    return ok({ purchase });
  } catch (err) {
    return serverError("cancel a purchase", err);
  }
}
