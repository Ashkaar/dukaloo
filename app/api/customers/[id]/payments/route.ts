import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { planIncludes } from "@/lib/features";
import { notFound, ok, parseBody, parseId, requireSection, serverError } from "@/lib/api";
import { newCustomerPaymentSchema } from "@/lib/customers";
import { customerBalance, customerPaymentsOf, getCustomer, recordCustomerPayment } from "@/lib/customersDb";

type Params = { params: Promise<{ id: string }> };

// GET → the customer's balance and repayments.
export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("customers", "till");
  if (error) return error;
  if (!(await planIncludes("customers"))) return notFound();
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    if (!(await getCustomer(id))) return notFound();
    return ok({ balanceCents: await customerBalance(id), payments: await customerPaymentsOf(id) });
  } catch (err) {
    return serverError("load a customer's account", err);
  }
}

// POST { clientId, amountCents, method, note } → money paid towards what they owe.
export async function POST(request: NextRequest, { params }: Params) {
  const { viewer, error: authError } = await requireSection("customers", "till");
  if (authError) return authError;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const { data, error } = await parseBody(request, newCustomerPaymentSchema);
  if (error) return error;
  try {
    const customer = await getCustomer(id);
    if (!customer) return notFound();
    const actor = viewer.kind === "owner" ? "" : viewer.name;
    await recordCustomerPayment(id, data, actor);
    await logActivity(actor || "owner", "customer-payment", customer.name);
    return ok({ balanceCents: await customerBalance(id), payments: await customerPaymentsOf(id) }, 201);
  } catch (err) {
    return serverError("record a customer payment", err);
  }
}
