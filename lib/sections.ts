// The parts of the app. Staff logins are given a chosen list of these;
// the owner sees everything the shop's plan includes. Safe to import from
// client components.
//
// A section is added here when its screens ship.

export const SECTIONS = ["dashboard", "till", "sales", "products", "purchases", "customers", "expenses", "reports", "staff", "settings"] as const;

export type Section = (typeof SECTIONS)[number];

// Sections only the owner (or the owner password entered on the device)
// may open; they can't be given to a staff login.
export const OWNER_SECTIONS: readonly Section[] = ["staff"];

// Sections a staff login can be given.
export const STAFF_SECTIONS: Section[] = SECTIONS.filter((s) => !OWNER_SECTIONS.includes(s));

export const SECTION_HREF: Record<Section, string> = {
  dashboard: "/dashboard",
  till: "/dashboard/till",
  sales: "/dashboard/sales",
  products: "/dashboard/products",
  purchases: "/dashboard/purchases",
  customers: "/dashboard/customers",
  expenses: "/dashboard/expenses",
  reports: "/dashboard/reports",
  staff: "/dashboard/staff",
  settings: "/dashboard/settings",
};

export const isSection = (value: unknown): value is Section => SECTIONS.includes(value as Section);

// Where to land after signing in: the first section the login may open.
export function homeFor(sections: readonly Section[]): string {
  const first = SECTIONS.find((s) => sections.includes(s));
  return first ? SECTION_HREF[first] : "/dashboard";
}

// The section a path inside the app belongs to ("/dashboard/staff/3" → "staff").
export function sectionOfPath(path: string): Section | null {
  let best: Section | null = null;
  for (const s of SECTIONS) {
    const href = SECTION_HREF[s];
    if ((path === href || path.startsWith(`${href}/`)) && (!best || href.length > SECTION_HREF[best].length)) best = s;
  }
  return best;
}

// Who is signed in, as the screens see it.
export interface Viewer {
  kind: "owner" | "staff";
  // "" for the owner.
  name: string;
  staffId: number | null;
  // Sections this login may open right now.
  sections: Section[];
  // May manage staff and owner settings (owner, or owner password entered here).
  isOwner: boolean;
  // The owner password is entered on this device (shows "Lock").
  unlocked: boolean;
}

export const MAX_STAFF_NAME_LENGTH = 40;
export const MIN_PASSWORD_LENGTH = 4;
export const MIN_OWNER_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 100;
