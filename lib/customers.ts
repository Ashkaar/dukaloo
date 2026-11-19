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
}

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
