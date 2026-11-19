import { ok, requireSection, serverError } from "@/lib/api";
import { buyableItems } from "@/lib/purchasesDb";

// GET → every item that can be bought in, with its current cost price.
export async function GET() {
  const { error } = await requireSection("purchases");
  if (error) return error;
  try {
    return ok({ items: await buyableItems() });
  } catch (err) {
    return serverError("load items", err);
  }
}
