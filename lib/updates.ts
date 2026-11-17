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

export const UPDATES: Update[] = [{ id: "catalog", at: "2026-11-17T22:00:00Z" }];

export function updatesSince(createdAtMs: number): Update[] {
  return UPDATES.filter((u) => Date.parse(u.at) > createdAtMs);
}
