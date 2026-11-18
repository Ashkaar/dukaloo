"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo } from "react";
import { withBase, withoutBase } from "@/lib/shopBase";

// The shop this page belongs to (from the root layout): its address and
// the details that come from Ariloo.
export interface ShopInfo {
  // "" in single-shop mode, "/city-market" for the shop at /city-market.
  base: string;
  name: string;
  branch: string;
  logoUrl: string | null;
  currency: string;
  decimals: 0 | 2;
  // The zone dates are shown in, and the shop's choice ("device" or a zone).
  timeZone: string;
  timeZoneSetting: string;
  // Where the owner manages the subscription; null in single-shop mode.
  accountUrl: string | null;
}

const ShopContext = createContext<ShopInfo>({
  base: "",
  name: "Dukaloo",
  branch: "",
  logoUrl: null,
  currency: "USD",
  decimals: 2,
  timeZone: "Asia/Baghdad",
  timeZoneSetting: "device",
  accountUrl: null,
});

export function ShopProvider({ value, children }: { value: ShopInfo; children: React.ReactNode }) {
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopInfo & { href: (path: string) => string } {
  const shop = useContext(ShopContext);
  return useMemo(() => ({ ...shop, href: (path: string) => withBase(path, shop.base) }), [shop]);
}

// The current path without the shop's address, e.g. "/dashboard/staff".
export function useAppPathname(): string {
  const { base } = useContext(ShopContext);
  return withoutBase(usePathname(), base);
}
