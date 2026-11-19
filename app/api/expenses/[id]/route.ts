import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { notFound, ok, parseId, requireOwner, serverError } from "@/lib/api";
import { deleteExpense } from "@/lib/expensesDb";

type Params = { params: Promise<{ id: string }> };

// DELETE → removes an expense from the books (owner).
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { viewer, error } = await requireOwner();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    if (!(await deleteExpense(id))) return notFound();
    await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "expense-deleted", String(id));
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete an expense", err);
  }
}
