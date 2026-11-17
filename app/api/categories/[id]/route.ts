import type { NextRequest } from "next/server";
import { badRequest, notFound, ok, parseBody, parseId, requireSection, serverError } from "@/lib/api";
import { categorySchema } from "@/lib/catalog";
import { categoryNameTaken, deleteCategory, renameCategory } from "@/lib/catalogDb";
import { getMessages } from "@/lib/i18n/server";

type Params = { params: Promise<{ id: string }> };

// PATCH { name } → renames a category.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error: authError } = await requireSection("products");
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { data, error } = await parseBody(request, categorySchema);
  if (error) return error;
  try {
    if (await categoryNameTaken(data.name, id)) return badRequest((await getMessages()).products.categoryTaken);
    return (await renameCategory(id, data.name)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("rename a category", err);
  }
}

// DELETE → removes a category; its products stay, without one.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("products");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return (await deleteCategory(id)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("delete a category", err);
  }
}
