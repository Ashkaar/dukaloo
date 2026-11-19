import type { NextRequest } from "next/server";
import { badRequest, ok, parseBody, requireSection, serverError } from "@/lib/api";
import { newExpenseSchema } from "@/lib/expenses";
import { createExpense, listExpenses } from "@/lib/expensesDb";
import { getMessages } from "@/lib/i18n/server";
import { requestToday } from "@/lib/settingsDb";

const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

// GET ?month=YYYY-MM → that month's expenses (default: this month).
export async function GET(request: NextRequest) {
  const { error } = await requireSection("expenses");
  if (error) return error;
  try {
    const asked = request.nextUrl.searchParams.get("month") ?? "";
    const month = /^\d{4}-\d{2}$/.test(asked) ? asked : (await requestToday()).day.slice(0, 7);
    return ok({ month, expenses: await listExpenses(`${month}-01`, `${nextMonth(month)}-01`) });
  } catch (err) {
    return serverError("list expenses", err);
  }
}

// POST { clientId, day, typeId, amountCents, method, note } → a new expense.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireSection("expenses");
  if (authError) return authError;
  const { data, error } = await parseBody(request, newExpenseSchema);
  if (error) return error;
  try {
    const result = await createExpense(data, viewer.kind === "owner" ? "" : viewer.name);
    if (!result.ok) return badRequest((await getMessages()).expenses.typeGone);
    return ok({ expense: result.expense }, 201);
  } catch (err) {
    return serverError("add an expense", err);
  }
}
