import type { NextRequest } from "next/server";
import { badRequest, ok, parseBody, requireSection, serverError } from "@/lib/api";
import { expenseTypeSchema } from "@/lib/expenses";
import { createExpenseType, expenseTypeTaken, listExpenseTypes } from "@/lib/expensesDb";
import { getMessages } from "@/lib/i18n/server";

export async function GET() {
  const { error } = await requireSection("expenses");
  if (error) return error;
  try {
    return ok({ types: await listExpenseTypes() });
  } catch (err) {
    return serverError("list expense types", err);
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireSection("expenses");
  if (authError) return authError;
  const { data, error } = await parseBody(request, expenseTypeSchema);
  if (error) return error;
  try {
    if (await expenseTypeTaken(data.name)) return badRequest((await getMessages()).expenses.typeTaken);
    return ok({ type: await createExpenseType(data.name) }, 201);
  } catch (err) {
    return serverError("add an expense type", err);
  }
}
