import type { NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { ok, parseBody, requireOwner, serverError } from "@/lib/api";
import { setTimeZoneSetting } from "@/lib/settingsDb";
import { DEVICE, isTimeZone } from "@/lib/timeZone";

const schema = z.object({ timeZone: z.string().refine((v) => v === DEVICE || isTimeZone(v)) });

// PUT { timeZone: "device" | "Asia/Baghdad" … } → the shop's time zone. Owner only.
export async function PUT(request: NextRequest) {
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    await setTimeZoneSetting(data.timeZone);
    await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "time-zone", data.timeZone);
    return ok({ ok: true });
  } catch (err) {
    return serverError("save the time zone", err);
  }
}
