import type { NextRequest } from "next/server";
import { notFound, ok, parseBody, parseId, requireSection, serverError } from "@/lib/api";
import { supplierSchema } from "@/lib/purchases";
import { archiveSupplier, updateSupplier } from "@/lib/purchasesDb";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { error: authError } = await requireSection("purchases");
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { data, error } = await parseBody(request, supplierSchema);
  if (error) return error;
  try {
    const supplier = await updateSupplier(id, data);
    return supplier ? ok({ supplier }) : notFound();
  } catch (err) {
    return serverError("change a supplier", err);
  }
}

// DELETE → hidden from lists; past purchases keep the name.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("purchases");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return (await archiveSupplier(id)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("delete a supplier", err);
  }
}
