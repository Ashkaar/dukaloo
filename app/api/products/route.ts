import type { NextRequest } from "next/server";
import { ok, readJson, requireSection, serverError } from "@/lib/api";
import { productSchema } from "@/lib/catalog";
import { listProducts } from "@/lib/catalogDb";
import { invalidProduct, save } from "./save";

// GET ?q=&category=&status=active|inactive|all&offset= → a page of products.
export async function GET(request: NextRequest) {
  const { error } = await requireSection("products");
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const category = Number(params.get("category"));
  const status = params.get("status");
  const offset = Number(params.get("offset"));
  try {
    const page = await listProducts({
      q: (params.get("q") ?? "").slice(0, 100),
      categoryId: Number.isInteger(category) && category > 0 ? category : null,
      status: status === "active" || status === "inactive" ? status : "all",
      limit: 50,
      offset: Number.isInteger(offset) && offset >= 0 && offset <= 1_000_000 ? offset : 0,
    });
    return ok(page);
  } catch (err) {
    return serverError("list products", err);
  }
}

// POST { product } → a new product with its variants.
export async function POST(request: NextRequest) {
  const { error } = await requireSection("products");
  if (error) return error;
  const parsed = productSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidProduct(parsed.error.issues);
  return save(parsed.data, null);
}
