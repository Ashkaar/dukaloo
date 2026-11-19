import { LayoutDashboardIcon, PackageIcon, ReceiptTextIcon, SettingsIcon, ShoppingCartIcon, UsersIcon, type LucideIcon } from "lucide-react";
import type { Messages } from "@/lib/i18n";
import { SECTION_HREF, type Section } from "@/lib/sections";

// How each section appears in the navigation. `primary` sections get a
// place on the phone's bottom bar; the rest go under "More".
export const NAV: Record<Section, { icon: LucideIcon; label: (t: Messages) => string; primary: boolean }> = {
  dashboard: { icon: LayoutDashboardIcon, label: (t) => t.nav.dashboard, primary: true },
  till: { icon: ShoppingCartIcon, label: (t) => t.nav.till, primary: true },
  sales: { icon: ReceiptTextIcon, label: (t) => t.nav.sales, primary: true },
  products: { icon: PackageIcon, label: (t) => t.nav.products, primary: true },
  staff: { icon: UsersIcon, label: (t) => t.nav.staff, primary: false },
  settings: { icon: SettingsIcon, label: (t) => t.nav.settings, primary: false },
};

export function navItems(sections: readonly Section[], t: Messages) {
  return sections.map((s) => ({ section: s, href: SECTION_HREF[s], label: NAV[s].label(t), icon: NAV[s].icon, primary: NAV[s].primary }));
}

export function isActive(path: string, href: string): boolean {
  return href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`);
}
