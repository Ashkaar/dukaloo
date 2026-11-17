import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { badRequest, notFound, ok, parseBody, parseId, requireOwner, serverError } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { staffChangesSchema } from "@/lib/staff";
import { deleteStaff, staffNameTaken, updateStaff } from "@/lib/staffDb";

type Params = { params: Promise<{ id: string }> };

// PATCH { name?, password?, permissions?, active? } → changes a staff login.
// A new password, or turning it off, signs that person out everywhere.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { data, error } = await parseBody(request, staffChangesSchema);
  if (error) return error;
  try {
    if (data.name !== undefined && (await staffNameTaken(data.name, id))) return badRequest((await getMessages()).staff.nameTaken);
    const user = await updateStaff(id, data);
    if (!user) return notFound();
    await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "staff-changed", user.name);
    return ok({ user });
  } catch (err) {
    return serverError("change a staff login", err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    if (!(await deleteStaff(id))) return notFound();
    await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "staff-deleted", String(id));
    return ok({ ok: true });
  } catch (err) {
    return serverError("delete a staff login", err);
  }
}
