import type { NextRequest } from "next/server";
import { badRequest, notFound, ok, parseBody, parseId, requireSection, serverError } from "@/lib/api";
import { customerSchema } from "@/lib/customers";
import { archiveCustomer, customerSales, getCustomer, phoneTaken, updateCustomer } from "@/lib/customersDb";
import { getMessages } from "@/lib/i18n/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("customers");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const customer = await getCustomer(id);
    return customer ? ok({ customer, sales: await customerSales(id) }) : notFound();
  } catch (err) {
    return serverError("load a customer", err);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { error: authError } = await requireSection("customers");
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { data, error } = await parseBody(request, customerSchema);
  if (error) return error;
  try {
    const taken = await phoneTaken(data.phone, id);
    if (taken) return badRequest((await getMessages()).customers.phoneTaken(taken.name));
    const customer = await updateCustomer(id, data);
    return customer ? ok({ customer }) : notFound();
  } catch (err) {
    return serverError("change a customer", err);
  }
}

// DELETE → removed from lists and the till; past sales keep the name.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("customers");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return (await archiveCustomer(id)) ? ok({ ok: true }) : notFound();
  } catch (err) {
    return serverError("delete a customer", err);
  }
}
