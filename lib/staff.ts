import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MAX_STAFF_NAME_LENGTH, MIN_PASSWORD_LENGTH, STAFF_SECTIONS, type Section } from "./sections";

// Staff logins: shared types and validation (client and server).

export interface StaffUser {
  id: number;
  name: string;
  permissions: Section[];
  active: boolean;
  createdAt: number;
}

const name = z.string().trim().min(1).max(MAX_STAFF_NAME_LENGTH);
const password = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);
const permissions = z
  .array(z.enum(STAFF_SECTIONS as [Section, ...Section[]]))
  .max(STAFF_SECTIONS.length)
  .transform((list) => [...new Set(list)]);

export const newStaffSchema = z.object({ name, password, permissions });
export const staffChangesSchema = z
  .object({ name, password, permissions, active: z.boolean() })
  .partial();
