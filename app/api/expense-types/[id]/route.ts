import type { NextRequest } from "next/server";
import { badRequest, notFound, ok, parseBody, parseId, requireSection, serverError } from "@/lib/api";
import { expenseTypeSchema } from "@/lib/expenses";
import { deleteExpenseType, expenseTypeTaken, renameExpenseType } from "@/lib/expensesDb";
import { getMessages } from "@/lib/i18n/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error: authError } = await requireSection("expenses");
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { data, error } = await parseBody(request, expenseTypeSchema);
  if (error) return error;
  try {
    if (await expenseTypeTaken(data.name, id)) return badRequest((await getMessages()).expenses.typeTaken);
    return (await renameExpenseType(id, data.name)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("rename an expense type", err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("expenses");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return (await deleteExpenseType(id)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("delete an expense type", err);
  }
}
