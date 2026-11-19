import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { badRequest, notFound, ok, parseBody, parseId, requireOwner, serverError } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { newReturnSchema } from "@/lib/sale";
import { createReturn } from "@/lib/salesDb";
import { shopProfile } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

// POST { clientId, lines: [{ saleLineId, qtyMilli }], method, note } → items
// given back and refunded. Owner, or the owner password entered on this device.
export async function POST(request: NextRequest, { params }: Params) {
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { data, error } = await parseBody(request, newReturnSchema);
  if (error) return error;
  try {
    const actor = viewer.kind === "owner" ? "" : viewer.name;
    const result = await createReturn(id, data, (await shopProfile()).decimals, actor);
    if (!result.ok) {
      if (result.reason === "not-found") return notFound();
      const t = (await getMessages()).returns;
      if (result.reason === "voided") return NextResponse.json({ error: t.saleVoided }, { status: 409 });
      if (result.reason === "credit-customer") return badRequest((await getMessages()).credit.needsCustomer);
      return badRequest(t.tooMany);
    }
    await logActivity(actor || "owner", "return", `#${result.sale.number}`);
    return ok({ sale: result.sale }, 201);
  } catch (err) {
    return serverError("record a return", err);
  }
}
