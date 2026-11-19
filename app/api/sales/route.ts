import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { badRequest, ok, parseBody, requireSection, serverError } from "@/lib/api";
import { dayOf, dayStart, formatMoney, nextDay } from "@/lib/format";
import { getMessages } from "@/lib/i18n/server";
import { newSaleSchema } from "@/lib/sale";
import { createSale, listSales } from "@/lib/salesDb";
import { getSalesSettings, requestTimeZone } from "@/lib/settingsDb";
import { shopProfile } from "@/lib/tenant";

// GET ?day=YYYY-MM-DD → that day's sales (in the shop's time zone), newest first.
export async function GET(request: NextRequest) {
  const { error } = await requireSection("sales");
  if (error) return error;
  try {
    const { timeZone } = await requestTimeZone();
    const asked = request.nextUrl.searchParams.get("day") ?? "";
    const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : dayOf(Date.now(), timeZone);
    return ok({ day, ...(await listSales(dayStart(day, timeZone), dayStart(nextDay(day), timeZone))) });
  } catch (err) {
    return serverError("list sales", err);
  }
}

// POST { clientId, lines, discount, payments, note, expectedTotalCents } → records a sale.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireSection("till");
  if (authError) return authError;
  const { data, error } = await parseBody(request, newSaleSchema);
  if (error) return error;
  const t = (await getMessages()).till;
  try {
    const [settings, profile] = await Promise.all([getSalesSettings(), shopProfile()]);
    const result = await createSale(data, settings, profile.decimals, { id: viewer.staffId, name: viewer.name });
    if (result.ok) return ok({ sale: result.sale }, 201);
    if (result.reason === "unavailable") return badRequest(t.unavailable(result.name));
    if (result.reason === "stock") return NextResponse.json({ error: t.outOfStock(result.name) }, { status: 409 });
    if (result.reason === "changed") {
      return NextResponse.json({ error: t.pricesChanged(formatMoney(result.totalCents, profile)) }, { status: 409 });
    }
    return badRequest(t.paymentShort);
  } catch (err) {
    return serverError("record a sale", err);
  }
}
