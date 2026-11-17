import type { NextRequest } from "next/server";
import { badRequest, ok, parseBody, requireSection, serverError } from "@/lib/api";
import { categorySchema } from "@/lib/catalog";
import { categoryNameTaken, createCategory, listCategories } from "@/lib/catalogDb";
import { getMessages } from "@/lib/i18n/server";

// GET → every category with its product count.
export async function GET() {
  const { error } = await requireSection("products");
  if (error) return error;
  try {
    return ok({ categories: await listCategories() });
  } catch (err) {
    return serverError("list categories", err);
  }
}

// POST { name } → a new category.
export async function POST(request: NextRequest) {
  const { error: authError } = await requireSection("products");
  if (authError) return authError;
  const { data, error } = await parseBody(request, categorySchema);
  if (error) return error;
  try {
    if (await categoryNameTaken(data.name)) return badRequest((await getMessages()).products.categoryTaken);
    return ok({ category: await createCategory(data.name) }, 201);
  } catch (err) {
    return serverError("add a category", err);
  }
}
