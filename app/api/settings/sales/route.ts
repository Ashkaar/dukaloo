import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { ok, parseBody, requireLogin, requireOwner, serverError } from "@/lib/api";
import { salesSettingsSchema } from "@/lib/sale";
import { getSalesSettings, setSalesSettings } from "@/lib/settingsDb";

export async function GET() {
  const { error } = await requireLogin();
  if (error) return error;
  try {
    return ok({ settings: await getSalesSettings() });
  } catch (err) {
    return serverError("load selling settings", err);
  }
}

// PUT { settings } → selling rules: stock, tax and receipt. Owner only.
export async function PUT(request: NextRequest) {
  const { viewer, error: authError } = await requireOwner();
  if (authError) return authError;
  const { data, error } = await parseBody(request, salesSettingsSchema);
  if (error) return error;
  try {
    await setSalesSettings(data);
    await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "selling-settings");
    return ok({ settings: await getSalesSettings() });
  } catch (err) {
    return serverError("save selling settings", err);
  }
}
