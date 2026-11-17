import "server-only";
import { NextResponse } from "next/server";
import { badRequest, notFound, ok, serverError } from "@/lib/api";
import type { ProductInput } from "@/lib/catalog";
import { categoryExists, getProduct, saveProduct } from "@/lib/catalogDb";
import { getMessages } from "@/lib/i18n/server";

// Shared by POST /api/products and PUT /api/products/[id].
export async function save(input: ProductInput, id: number | null): Promise<NextResponse> {
  const t = (await getMessages()).products;
  try {
    if (input.categoryId !== null && !(await categoryExists(input.categoryId))) return badRequest();
    const result = await saveProduct(input, id);
    if (!result.ok) {
      if ("notFound" in result) return notFound();
      const { kind, code, productName } = result.conflict;
      return badRequest(kind === "barcode" ? t.barcodeTaken(code, productName) : t.skuTaken(code, productName));
    }
    return ok({ product: await getProduct(result.id) }, id === null ? 201 : 200);
  } catch (err) {
    // Two tills saving the same new code at once: the database refuses the second.
    if (String(err).includes("UNIQUE")) return badRequest(t.duplicateCodes);
    return serverError("save a product", err);
  }
}

// The validation message for a product body that doesn't fit the schema.
export async function invalidProduct(issues: { message: string }[]): Promise<NextResponse> {
  const t = (await getMessages()).products;
  const messages = issues.map((i) => i.message);
  if (messages.some((m) => m === "duplicate barcode" || m === "duplicate sku")) return badRequest(t.duplicateCodes);
  if (messages.some((m) => m === "duplicate option value" || m === "duplicate variant")) return badRequest(t.duplicateValues);
  return badRequest();
}
