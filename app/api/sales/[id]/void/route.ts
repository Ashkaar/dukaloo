import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { NextResponse } from "next/server";
import { notFound, ok, parseId, requireOwner, serverError } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { getSale, voidSale } from "@/lib/salesDb";

type Params = { params: Promise<{ id: string }> };

// POST → cancels a sale (owner, or owner password entered on this device).
// It stays in the records as voided; its items go back into stock.
export async function POST(_request: NextRequest, { params }: Params) {
  const { viewer, error } = await requireOwner();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const actor = viewer.kind === "owner" ? "owner" : viewer.name;
    const before = await getSale(id);
    if (!before) return notFound();
    // Refunds already given would be counted twice: return the rest instead.
    if (before.returns.length > 0) return NextResponse.json({ error: (await getMessages()).returns.cantVoid }, { status: 409 });
    if (!(await voidSale(id, actor))) return notFound();
    const sale = await getSale(id);
    await logActivity(actor, "sale-voided", `#${sale?.number ?? id}`);
    return ok({ sale });
  } catch (err) {
    return serverError("void a sale", err);
  }
}
