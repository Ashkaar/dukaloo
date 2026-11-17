import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_ROOTS } from "@/lib/appRoots";
import { isShopSlug } from "@/lib/shopState";

// Routing for many shops (Next 16's replacement for middleware).
//
// Many-shop mode (ARILOO_DB_URL and ARILOO_DB_TOKEN set): /<shop>/… is
// served by the same pages as …, with the shop passed on in a request
// header that only this function can set. Sign-in is checked by the pages
// and API routes themselves, because each shop has its own signing key,
// kept in its own database.
//
// Single-shop mode: the plain paths, unchanged.

const SHOP_HEADER = "x-dukaloo-shop";

const multiShop = () => Boolean(process.env.ARILOO_DB_URL && process.env.ARILOO_DB_TOKEN);
const arilooUrl = () => (process.env.ARILOO_URL || "https://ariloo.app").replace(/\/+$/, "");

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Never trust a shop header sent by the browser.
  headers.delete(SHOP_HEADER);
  if (!multiShop()) return NextResponse.next({ request: { headers } });

  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";

  if (first && !APP_ROOTS.has(first)) {
    if (!isShopSlug(first)) return new NextResponse(null, { status: 404 });
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(first.length + 1) || "/";
    headers.set(SHOP_HEADER, first);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Files every shop shares.
  if (first === "sw.js" || first === "offline.html" || first === "icon" || first === "apple-icon") {
    return NextResponse.next({ request: { headers } });
  }
  // The bare domain belongs to Ariloo's storefront.
  if (pathname === "/") return NextResponse.redirect(arilooUrl());
  // An app path without a shop in front of it.
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:png|svg|ico|webp|woff2?)$).*)"],
};
