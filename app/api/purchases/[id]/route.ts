import type { NextRequest } from "next/server";
import { notFound, ok, parseId, requireSection, serverError } from "@/lib/api";
import { getPurchase } from "@/lib/purchasesDb";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("purchases");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const purchase = await getPurchase(id);
    return purchase ? ok({ purchase }) : notFound();
  } catch (err) {
    return serverError("load a purchase", err);
  }
}
