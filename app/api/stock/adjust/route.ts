import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, ok, parseBody, requireSection, serverError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { productVariants } from "@/lib/db/schema";
import { adjustStock } from "@/lib/stockDb";
import { eq } from "drizzle-orm";

const schema = z.object({
  variantId: z.number().int().positive(),
  mode: z.enum(["set", "add", "remove"]),
  qtyMilli: z.number().int().min(0).max(1_000_000_000),
  note: z.string().trim().max(200),
});

// POST { variantId, mode, qtyMilli, note } → records a stock change; returns the new level.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireSection("products");
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    const db = await getDb();
    const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.id, data.variantId));
    if (!variant) return badRequest();
    const level = await adjustStock(data.variantId, data.mode, data.qtyMilli, data.note, viewer.kind === "owner" ? "owner" : viewer.name);
    return ok({ stockMilli: level });
  } catch (err) {
    return serverError("adjust stock", err);
  }
}
