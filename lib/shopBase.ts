// The shop's address in the browser. In single-shop mode the app lives at
// the plain paths and the base is "". With many shops, the shop at
// /city-market has the base "/city-market": every link, request and saved
// setting carries it, so two shops never mix on one device.
//
// The root layout writes the base on <html data-shop-base>, so plain
// functions (fetch helpers, event handlers) can read it; components that
// render links use useShop() from components/shop-provider.tsx instead.

export function shopBase(): string {
  return typeof document === "undefined" ? "" : (document.documentElement.dataset.shopBase ?? "");
}

// "/api/staff" → "/city-market/api/staff". Leaves other URLs alone.
export function withBase(url: string, base = shopBase()): string {
  if (!base || !url.startsWith("/") || url.startsWith("//") || url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

// "/city-market/dashboard/staff" → "/dashboard/staff", for comparing with the app's own paths.
export function withoutBase(pathname: string, base = shopBase()): string {
  if (!base) return pathname;
  return pathname === base ? "/" : pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

// A key for localStorage / IndexedDB that each shop has its own copy of.
export function shopKey(key: string, base = shopBase()): string {
  return base ? `${key}:${base.slice(1)}` : key;
}

// When the shop was created (ms; 0 in single-shop mode): "What's new" only
// tells a shop about changes made after it.
export function shopSince(): number {
  return typeof document === "undefined" ? 0 : Number(document.documentElement.dataset.shopSince ?? 0) || 0;
}
