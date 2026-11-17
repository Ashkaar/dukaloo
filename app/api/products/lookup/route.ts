import type { NextRequest } from "next/server";
import { badRequest, notFound, ok, requireSection, serverError } from "@/lib/api";
import { BARCODE_PATTERN } from "@/lib/catalog";
import { findByCode } from "@/lib/catalogDb";

// GET ?code= → the live variant with this barcode (or SKU).
export async function GET(request: NextRequest) {
  const { error } = await requireSection("products");
  if (error) return error;
  const code = (request.nextUrl.searchParams.get("code") ?? "").trim();
  if (!BARCODE_PATTERN.test(code)) return badRequest();
  try {
    const match = await findByCode(code);
    return match ? ok({ match }) : notFound();
  } catch (err) {
    return serverError("look up a code", err);
  }
}
