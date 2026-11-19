import type { NextRequest } from "next/server";
import { ok, parseBody, requireSection, serverError } from "@/lib/api";
import { supplierSchema } from "@/lib/purchases";
import { createSupplier, listSuppliers } from "@/lib/purchasesDb";

export async function GET() {
  const { error } = await requireSection("purchases");
  if (error) return error;
  try {
    return ok({ suppliers: await listSuppliers() });
  } catch (err) {
    return serverError("list suppliers", err);
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireSection("purchases");
  if (authError) return authError;
  const { data, error } = await parseBody(request, supplierSchema);
  if (error) return error;
  try {
    return ok({ supplier: await createSupplier(data) }, 201);
  } catch (err) {
    return serverError("add a supplier", err);
  }
}
