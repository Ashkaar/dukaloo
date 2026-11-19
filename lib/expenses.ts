import { z } from "zod";
import { PAYMENT_METHODS, type PaymentMethod } from "./sale";

// Expenses: shared types and validation (client and server).

export interface ExpenseType {
  id: number;
  name: string;
}

export interface Expense {
  id: number;
  day: string;
  typeId: number | null;
  typeName: string;
  amountCents: number;
  method: PaymentMethod;
  note: string;
  staffName: string;
  createdAt: number;
}

export const expenseTypeSchema = z.object({ name: z.string().trim().min(1).max(60) });

export const newExpenseSchema = z.object({
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  typeId: z.number().int().positive().nullable(),
  amountCents: z.number().int().min(1).max(10_000_000_000_000),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(300),
});
export type NewExpense = z.infer<typeof newExpenseSchema>;
