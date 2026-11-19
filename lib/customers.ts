import { z } from "zod";
import { toLatinDigits } from "./format";

// Customers: shared types and validation (client and server).

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  createdAt: number;
}

export interface CustomerSummary extends Customer {
  visits: number;
  spentCents: number;
  lastVisit: number | null;
  // What they owe from credit sales, after repayments and credit refunds.
  balanceCents: number;
}

// A repayment towards what a customer owes.
export interface CustomerPayment {
  id: number;
  at: number;
  amountCents: number;
  method: "cash" | "card" | "transfer";
  note: string;
  staffName: string;
}

export const newCustomerPaymentSchema = z.object({
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  amountCents: z.number().int().min(1).max(10_000_000_000_000),
  method: z.enum(["cash", "card", "transfer"]),
  note: z.string().trim().max(200),
});
export type NewCustomerPayment = z.infer<typeof newCustomerPaymentSchema>;

// Phone numbers are kept as digits (and a leading +), so "0750 123 4567"
// and "07501234567" are the same customer.
export function normalisePhone(raw: string): string {
  const latin = toLatinDigits(raw.trim());
  const plus = latin.startsWith("+") ? "+" : "";
  return plus + latin.replace(/\D/g, "");
}

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .max(30)
    .transform(normalisePhone)
    .refine((p) => p === "" || /^\+?\d{4,20}$/.test(p)),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((e) => e === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
  address: z.string().trim().max(200),
  note: z.string().trim().max(500),
});
export type CustomerInput = z.infer<typeof customerSchema>;
