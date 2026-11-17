import type { NextRequest } from "next/server";
import { notFound, ok, parseId, readJson, requireSection, serverError } from "@/lib/api";
import { productSchema } from "@/lib/catalog";
import { archiveProduct, getProduct } from "@/lib/catalogDb";
import { invalidProduct, save } from "../save";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("products");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const product = await getProduct(id);
    return product ? ok({ product }) : notFound();
  } catch (err) {
    return serverError("load a product", err);
  }
}

// PUT { product } → replaces the product and its variants.
export async function PUT(request: NextRequest, { params }: Params) {
  const { error } = await requireSection("products");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const parsed = productSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidProduct(parsed.error.issues);
  return save(parsed.data, id);
}

// DELETE → archives the product (kept for past sales and stock records).
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("products");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return (await archiveProduct(id)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("delete a product", err);
  }
}
