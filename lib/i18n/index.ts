import ar from "./ar";
import en, { type Messages } from "./en";
import ku from "./ku";
import tr from "./tr";

// The languages the app speaks. Adding text anywhere means adding it to
// en.ts and to every other dictionary; their `Messages` type makes a
// missing key a type error.

export type { Messages };

export const LANGUAGES = {
  en: { label: "English", dir: "ltr", intl: "en-GB", html: "en" },
  ku: { label: "کوردی", dir: "rtl", intl: "ckb-IQ", html: "ckb" },
  ar: { label: "العربية", dir: "rtl", intl: "ar-IQ", html: "ar" },
  tr: { label: "Türkçe", dir: "ltr", intl: "tr-TR", html: "tr" },
} as const;

export type Lang = keyof typeof LANGUAGES;
export type Dir = "ltr" | "rtl";

export const LANG_CODES = Object.keys(LANGUAGES) as Lang[];
export const DEFAULT_LANG: Lang = "en";
// Chosen per device, remembered for a year, read on the server so the first
// render is already in the right language and direction.
export const LANG_COOKIE = "dukaloo_lang";

export const MESSAGES: Record<Lang, Messages> = { en, ku, ar, tr };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGUAGES, value);
}

// Locale for Intl number and date formatting. Western digits everywhere,
// so amounts look like what the cashier types and the scanner reads.
export function intlLocale(lang: Lang): string {
  return `${LANGUAGES[lang].intl}-u-nu-latn`;
}

// ---- Owner's corrections -------------------------------------------------
// The owner can correct any plain text (not texts with values in them).
// Corrections are kept per language as { "staff.title": "Team" }.

export type Overrides = Record<string, string>;

export function applyOverrides(messages: Messages, overrides: Overrides): Messages {
  if (Object.keys(overrides).length === 0) return messages;
  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === "string") return overrides[path] ?? node;
    if (node && typeof node === "object" && !Array.isArray(node)) {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, path ? `${path}.${k}` : k)]));
    }
    return node;
  };
  return walk(messages, "") as Messages;
}

// Every correctable text: [key, English text].
export function textKeys(messages: Messages = en): [string, string][] {
  const out: [string, string][] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") out.push([path, node]);
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(messages, "");
  return out;
}
