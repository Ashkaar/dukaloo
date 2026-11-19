import { describe, expect, it } from "vitest";
import { customerSchema, newCustomerPaymentSchema, normalisePhone } from "@/lib/customers";

describe("customers", () => {
  it("keep phone numbers as digits", () => {
    expect(normalisePhone("0750 123 4567")).toBe("07501234567");
    expect(normalisePhone("+964 (750) 123-4567")).toBe("+9647501234567");
    expect(normalisePhone("٠٧٥٠١٢٣٤٥٦٧")).toBe("07501234567");
  });
  it("validate the fields", () => {
    const ok = { name: "Ali", phone: "0750 123 4567", email: "", address: "", note: "" };
    expect(customerSchema.parse(ok).phone).toBe("07501234567");
    expect(customerSchema.safeParse({ ...ok, name: " " }).success).toBe(false);
    expect(customerSchema.safeParse({ ...ok, phone: "12" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...ok, email: "not-an-email" }).success).toBe(false);
  });
});

describe("customer payments", () => {
  it("take real money, never another credit", () => {
    const ok = { clientId: "abcdef12", amountCents: 500, method: "cash", note: "" };
    expect(newCustomerPaymentSchema.safeParse(ok).success).toBe(true);
    expect(newCustomerPaymentSchema.safeParse({ ...ok, method: "credit" }).success).toBe(false);
    expect(newCustomerPaymentSchema.safeParse({ ...ok, amountCents: 0 }).success).toBe(false);
    expect(newCustomerPaymentSchema.safeParse({ ...ok, amountCents: 1.5 }).success).toBe(false);
  });
});
