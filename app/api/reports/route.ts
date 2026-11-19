import type { NextRequest } from "next/server";
import { badRequest, ok, requireSection, serverError } from "@/lib/api";
import { buildReport } from "@/lib/reportsDb";
import { requestToday } from "@/lib/settingsDb";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (both included, up to about a year).
export async function GET(request: NextRequest) {
  const { error } = await requireSection("reports");
  if (error) return error;
  const params = request.nextUrl.searchParams;
  try {
    const { day, timeZone } = await requestToday();
    const from = params.get("from") ?? day;
    const to = params.get("to") ?? day;
    if (!DAY.test(from) || !DAY.test(to) || from > to) return badRequest();
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 370) return badRequest();
    return ok({ report: await buildReport(from, to, timeZone) });
  } catch (err) {
    return serverError("build a report", err);
  }
}
