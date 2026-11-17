import { ok, requireSection, serverError } from "@/lib/api";
import { newInternalBarcode } from "@/lib/catalogDb";

// POST → a new in-store EAN-13 barcode (starting with 2) no product uses yet.
export async function POST() {
  const { error } = await requireSection("products");
  if (error) return error;
  try {
    return ok({ barcode: await newInternalBarcode() });
  } catch (err) {
    return serverError("make a barcode", err);
  }
}
