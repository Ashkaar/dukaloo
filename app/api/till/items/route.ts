import { ok, requireSection, serverError } from "@/lib/api";
import { tillItems } from "@/lib/salesDb";
import { getSalesSettings } from "@/lib/settingsDb";

// GET → everything the till can sell (with stock), and the selling settings.
export async function GET() {
  const { error } = await requireSection("till");
  if (error) return error;
  try {
    const [items, settings] = await Promise.all([tillItems(), getSalesSettings()]);
    return ok({ items, settings });
  } catch (err) {
    return serverError("load the till", err);
  }
}
