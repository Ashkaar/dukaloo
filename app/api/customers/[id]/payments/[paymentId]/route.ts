import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { notFound, ok, parseId, requireOwner, serverError } from "@/lib/api";
import { customerBalance, customerPaymentsOf, deleteCustomerPayment } from "@/lib/customersDb";

type Params = { params: Promise<{ id: string; paymentId: string }> };

// DELETE → removes a repayment entered by mistake (owner).
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { viewer, error } = await requireOwner();
  if (error) return error;
  const p = await params;
  const id = parseId(p.id);
  const paymentId = parseId(p.paymentId);
  if (!id || !paymentId) return notFound();
  try {
    if (!(await deleteCustomerPayment(id, paymentId))) return notFound();
    await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "customer-payment-deleted", String(paymentId));
    return ok({ balanceCents: await customerBalance(id), payments: await customerPaymentsOf(id) });
  } catch (err) {
    return serverError("delete a customer payment", err);
  }
}
