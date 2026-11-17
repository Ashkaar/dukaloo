import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { badRequest, ok, parseBody, requireOwner, serverError } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { newStaffSchema } from "@/lib/staff";
import { createStaff, listStaff, staffNameTaken } from "@/lib/staffDb";

// GET → every staff login (never passwords). Owner only.
export async function GET() {
  const { error } = await requireOwner();
  if (error) return error;
  try {
    return ok({ staff: await listStaff() });
  } catch (err) {
    return serverError("list staff", err);
  }
}

// POST { name, password, permissions } → a new staff login. Owner only.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, newStaffSchema);
  if (error) return error;
  try {
    if (await staffNameTaken(data.name)) return badRequest((await getMessages()).staff.nameTaken);
    const user = await createStaff(data.name, data.password, data.permissions);
    await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "staff-added", user.name);
    return ok({ user }, 201);
  } catch (err) {
    return serverError("add a staff login", err);
  }
}
