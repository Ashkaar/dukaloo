import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getShopDb } from "../db";
import { textOverrides } from "../db/schema";
import { currentShop } from "../tenant";
import { applyOverrides, DEFAULT_LANG, isLang, LANG_COOKIE, MESSAGES, type Lang, type Messages, type Overrides } from "./index";

// The visitor's language on the server (layouts, API error messages): the
// one chosen on this device, else the shop's language from Ariloo (or
// SHOP_LANG in single-shop mode), else English.
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(value)) return value;
  try {
    const shop = await currentShop();
    const lang = shop ? shop.lang : process.env.SHOP_LANG;
    if (isLang(lang)) return lang;
  } catch {
    // No such shop: the page says so, in the default language.
  }
  return DEFAULT_LANG;
}

// The owner's corrections, read at most every few seconds per server
// instance. A database problem never breaks the page: the built-in texts
// are used instead.
const cache = new Map<string, { at: number; overrides: Overrides }>();
const TTL_MS = 5_000;

export async function getOverrides(lang: Lang): Promise<Overrides> {
  let key = "";
  try {
    const { db, key: dbKey } = await getShopDb();
    key = `${dbKey}:${lang}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.overrides;
    const rows = await db.select().from(textOverrides).where(eq(textOverrides.lang, lang));
    const overrides = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    cache.set(key, { at: Date.now(), overrides });
    return overrides;
  } catch (err) {
    console.error("Couldn't load text corrections:", err);
    return cache.get(key)?.overrides ?? {};
  }
}

export async function getMessages(): Promise<Messages> {
  const lang = await getLang();
  return applyOverrides(MESSAGES[lang], await getOverrides(lang));
}
