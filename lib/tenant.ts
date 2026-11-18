import "server-only";
import { createClient, type Client } from "@libsql/client";
import { headers } from "next/headers";
import { isShopSlug, shopStateOf, isOpenState, type PlanId, type ShopState } from "./shopState";

// Many shops on one Dukaloo.
//
// With ARILOO_DB_URL and ARILOO_DB_TOKEN set, Dukaloo serves every shop
// registered at Ariloo for product 'dukaloo': each shop lives at /<shop>/…
// (proxy.ts strips the prefix and passes the shop on in a request header),
// has its own database, and gets its name, logo, colour, currency and plan
// from Ariloo's ariloo_shops table, which Dukaloo only ever reads.
//
// Without them, Dukaloo serves one shop at the plain paths from
// DB_TURSO_DATABASE_URL ("single-shop mode", for local development).

export const SHOP_HEADER = "x-dukaloo-shop";

export const multiShop = (): boolean => Boolean(process.env.ARILOO_DB_URL && process.env.ARILOO_DB_TOKEN);
export const arilooUrl = (): string => (process.env.ARILOO_URL || "https://ariloo.app").replace(/\/+$/, "");
export const accountUrl = (): string => `${arilooUrl()}/account`;

export interface Shop {
  id: number;
  slug: string;
  name: string;
  branch: string;
  colour: string;
  currency: string;
  decimals: 0 | 2;
  lang: string;
  logoUrl: string | null;
  state: ShopState;
  // Open in trial, active and grace.
  open: boolean;
  // The plan that decides the sections: "advanced" (everything) during a
  // trial, the paid plan when active or in grace, null otherwise.
  plan: PlanId | null;
  dbUrl: string | null;
  // Subscription dates (ms), for the owner's dashboard.
  trialEndsAt: number | null;
  paidUntil: number | null;
  // When the shop was created (ms), so it isn't told about older changes.
  createdAt: number;
}

export class ShopError extends Error {
  constructor(public code: "unknown" | "no-database") {
    super(code === "unknown" ? "No such shop." : "This shop has no database yet.");
  }
}

// ---- Ariloo's registry ------------------------------------------------------

const TTL_MS = 30_000;
let registry: Client | null = null;
const shops = new Map<string, { at: number; shop: Shop | null }>();

export function rowToShop(row: Record<string, unknown>, now: number): Shop {
  const paidUntil = row.paid_until == null ? null : Number(row.paid_until);
  const trialEndsAt = row.trial_ends_at == null ? null : Number(row.trial_ends_at);
  const state = shopStateOf({ suspended: Number(row.suspended) === 1, paidUntil, trialEndsAt }, now);
  const paidPlan = row.plan === "starter" || row.plan === "pro" || row.plan === "advanced" ? row.plan : null;
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.business_name ?? ""),
    branch: String(row.branch_name ?? ""),
    colour: String(row.colour ?? ""),
    currency: String(row.currency ?? "USD"),
    decimals: Number(row.decimals) === 0 ? 0 : 2,
    lang: String(row.lang ?? "en"),
    logoUrl: row.logo_mime ? `${arilooUrl()}/api/shop-logo/${Number(row.id)}?v=${Number(row.logo_version ?? 0)}` : null,
    state,
    open: isOpenState(state),
    plan: state === "trial" ? "advanced" : state === "active" || state === "grace" ? paidPlan : null,
    dbUrl: row.db_url ? String(row.db_url) : null,
    trialEndsAt,
    paidUntil,
    createdAt: Number(row.created_at) || 0,
  };
}

async function loadShop(slug: string): Promise<Shop | null> {
  registry ??= createClient({ url: process.env.ARILOO_DB_URL!, authToken: process.env.ARILOO_DB_TOKEN });
  const { rows } = await registry.execute({
    sql: `SELECT id, slug, business_name, branch_name, colour, currency, decimals, lang, logo_mime, logo_version,
                 plan, trial_ends_at, paid_until, suspended, db_url, created_at
          FROM ariloo_shops WHERE slug = ? AND product = 'dukaloo'`,
    args: [slug],
  });
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? rowToShop(row, Date.now()) : null;
}

// The shop this request is for: null in single-shop mode, and a ShopError
// when the address names no Dukaloo shop. Looked up at most every 30 seconds.
export async function currentShop(): Promise<Shop | null> {
  if (!multiShop()) return null;
  const slug = (await headers()).get(SHOP_HEADER);
  if (!slug || !isShopSlug(slug)) throw new ShopError("unknown");
  const hit = shops.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) {
    if (!hit.shop) throw new ShopError("unknown");
    return hit.shop;
  }
  const shop = await loadShop(slug);
  shops.set(slug, { at: Date.now(), shop });
  if (!shop) throw new ShopError("unknown");
  return shop;
}

// "" in single-shop mode, "/city-market" for the shop at /city-market.
export async function shopBase(): Promise<string> {
  if (!multiShop()) return "";
  const slug = (await headers()).get(SHOP_HEADER);
  return slug && isShopSlug(slug) ? `/${slug}` : "";
}

// A path inside the app, as the browser must ask for it: "/login" → "/city-market/login".
export async function shopPath(path: string): Promise<string> {
  return `${await shopBase()}${path}`;
}

// Cookies are kept per shop, so one device can be signed in to two.
export async function cookiePath(): Promise<string> {
  return (await shopBase()) || "/";
}

// Where the shop's data lives and the token that opens it.
export async function shopDatabase(): Promise<{ url: string; authToken: string | undefined; shop: Shop | null }> {
  const shop = await currentShop();
  if (!shop) return { url: process.env.DB_TURSO_DATABASE_URL ?? "", authToken: process.env.DB_TURSO_AUTH_TOKEN || undefined, shop };
  if (!shop.dbUrl) throw new ShopError("no-database");
  return { url: shop.dbUrl, authToken: process.env.SHOPS_DB_TOKEN, shop };
}

// What the screens need to know about the shop, in either mode. Currency,
// decimals, name and colour always come from Ariloo's row (never copied
// into the shop's database), so a change there shows within 30 seconds.
export interface ShopProfile {
  name: string;
  branch: string;
  colour: string | null;
  currency: string;
  decimals: 0 | 2;
  lang: string;
  logoUrl: string | null;
  createdAt: number;
}

export function profileOf(shop: Shop | null): ShopProfile {
  if (shop) {
    return {
      name: shop.name,
      branch: shop.branch,
      colour: /^#[0-9a-f]{6}$/i.test(shop.colour) ? shop.colour : null,
      currency: shop.currency,
      decimals: shop.decimals,
      lang: shop.lang,
      logoUrl: shop.logoUrl,
      createdAt: shop.createdAt,
    };
  }
  return {
    name: process.env.SHOP_NAME || "Dukaloo",
    branch: "",
    colour: null,
    currency: process.env.SHOP_CURRENCY || "USD",
    decimals: process.env.SHOP_DECIMALS === "0" ? 0 : 2,
    lang: process.env.SHOP_LANG || "en",
    logoUrl: null,
    createdAt: 0,
  };
}

export async function shopProfile(): Promise<ShopProfile> {
  return profileOf(await currentShop());
}
