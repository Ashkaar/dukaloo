import type { NextRequest } from "next/server";
import { badRequest, ok, parseBody, requireSection, serverError } from "@/lib/api";
import { customerSchema } from "@/lib/customers";
import { createCustomer, listCustomers, phoneTaken } from "@/lib/customersDb";
import { getMessages } from "@/lib/i18n/server";

// GET ?q=&offset= → customers by name or phone. The till uses it to pick one.
export async function GET(request: NextRequest) {
  const { error } = await requireSection("customers", "till");
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const offset = Number(params.get("offset"));
  const limit = Number(params.get("limit"));
  try {
    return ok(
      await listCustomers(
        (params.get("q") ?? "").slice(0, 80),
        Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : 50,
        Number.isInteger(offset) && offset >= 0 && offset <= 1_000_000 ? offset : 0,
      ),
    );
  } catch (err) {
    return serverError("list customers", err);
  }
}

// POST { name, phone, email, address, note } → a new customer (also from the till).
export async function POST(request: NextRequest) {
  const { error: authError } = await requireSection("customers", "till");
  if (authError) return authError;
  const { data, error } = await parseBody(request, customerSchema);
  if (error) return error;
  try {
    const taken = await phoneTaken(data.phone);
    if (taken) return badRequest((await getMessages()).customers.phoneTaken(taken.name));
    return ok({ customer: await createCustomer(data) }, 201);
  } catch (err) {
    return serverError("add a customer", err);
  }
}
