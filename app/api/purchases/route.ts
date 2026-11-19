import type { NextRequest } from "next/server";
import { badRequest, ok, parseBody, requireSection, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getMessages } from "@/lib/i18n/server";
import { newPurchaseSchema } from "@/lib/purchases";
import { createPurchase, listPurchases } from "@/lib/purchasesDb";

// GET ?offset= → purchases, newest first.
export async function GET(request: NextRequest) {
  const { error } = await requireSection("purchases");
  if (error) return error;
  const offset = Number(request.nextUrl.searchParams.get("offset"));
  try {
    return ok(await listPurchases(50, Number.isInteger(offset) && offset >= 0 ? offset : 0));
  } catch (err) {
    return serverError("list purchases", err);
  }
}

// POST { clientId, supplierId, reference, note, updateCosts, lines } → stock in.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireSection("purchases");
  if (authError) return authError;
  const { data, error } = await parseBody(request, newPurchaseSchema);
  if (error) return error;
  try {
    const actor = viewer.kind === "owner" ? "" : viewer.name;
    const result = await createPurchase(data, actor);
    if (!result.ok) {
      const t = (await getMessages()).purchases;
      return badRequest(result.reason === "supplier" ? t.supplierGone : t.itemGone);
    }
    await logActivity(actor || "owner", "purchase", `#${result.purchase.number}`);
    return ok({ purchase: result.purchase }, 201);
  } catch (err) {
    return serverError("record a purchase", err);
  }
}
