import type { NextRequest } from "next/server";
import { notFound, ok, parseId, requireSection, serverError } from "@/lib/api";
import { getSale } from "@/lib/salesDb";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("sales", "till");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const sale = await getSale(id);
    return sale ? ok({ sale }) : notFound();
  } catch (err) {
    return serverError("load a sale", err);
  }
}
