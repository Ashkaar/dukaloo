import { z } from "zod";
import { customerSchema } from "./customers";

// Suppliers and purchases: shared types and validation (client and server).

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  createdAt: number;
}

// Same fields and rules as a customer.
export const supplierSchema = customerSchema;

export interface PurchaseLine {
  variantId: number;
  name: string;
  variantLabel: string;
  qtyMilli: number;
  unitCostCents: number;
  totalCents: number;
}

export interface Purchase {
  id: number;
  number: number;
  at: number;
  supplierId: number | null;
  supplierName: string;
  reference: string;
  note: string;
  totalCents: number;
  staffName: string;
  status: "received" | "cancelled";
  lines: PurchaseLine[];
}

export interface PurchaseSummary {
  id: number;
  number: number;
  at: number;
  supplierName: string;
  reference: string;
  totalCents: number;
  status: "received" | "cancelled";
  itemCount: number;
}

// An item that can be bought in, as the purchase form keeps it.
export interface BuyableItem {
  variantId: number;
  name: string;
  variantLabel: string;
  unit: string;
  barcode: string;
  sku: string;
  costCents: number;
}

const cents = z.number().int().min(0).max(10_000_000_000_000);

export const newPurchaseSchema = z.object({
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  supplierId: z.number().int().positive().nullable(),
  reference: z.string().trim().max(60),
  note: z.string().trim().max(300),
  // Set each item's cost price to what was paid now.
  updateCosts: z.boolean(),
  lines: z
    .array(z.object({ variantId: z.number().int().positive(), qtyMilli: z.number().int().min(1).max(1_000_000_000), unitCostCents: cents }))
    .min(1)
    .max(500),
});
export type NewPurchase = z.infer<typeof newPurchaseSchema>;

// A line's cost: quantity (thousandths) × unit cost, to the cent.
export const lineCost = (qtyMilli: number, unitCostCents: number) => Math.round((qtyMilli * unitCostCents) / 1000);
