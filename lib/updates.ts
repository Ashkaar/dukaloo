import type { Messages } from "./i18n";

// "What's new": one entry per notable change, newest first, with its title
// and text in all four languages under `updates.items.<id>` in lib/i18n.
// `at` is when the change went live (ISO time). A shop is only told about
// changes made after it was created (Ariloo's created_at), so a new shop
// starts with an empty list.

export type UpdateId = keyof Messages["updates"]["items"];

export interface Update {
  id: UpdateId;
  at: string;
}

export const UPDATES: Update[] = [
  { id: "customers", at: "2026-11-19T20:00:00Z" },
  { id: "camera", at: "2026-11-19T19:00:00Z" },
  { id: "returns", at: "2026-11-19T18:00:00Z" },
  { id: "till", at: "2026-11-19T12:00:00Z" },
  { id: "timeZone", at: "2026-11-18T10:00:00Z" },
  { id: "catalog", at: "2026-11-17T22:00:00Z" },
];

export function updatesSince(createdAtMs: number): Update[] {
  return UPDATES.filter((u) => Date.parse(u.at) > createdAtMs);
}
