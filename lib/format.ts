import { MESSAGES, type Lang } from "./i18n";

// Formatting shared by every screen. Safe on client and server, and
// DETERMINISTIC: the server (Node) and the browser must produce exactly the
// same text, or React throws the page away on hydration. So nothing here
// relies on locale data that differs between ICU builds: digits are always
// Western, grouping is fixed, month names come from our own dictionaries,
// and times are worked out in the shop's time zone, not the device's.
//
// Money is always an integer number of hundredths ("cents") of the shop's
// currency, whatever the currency. A shop with 0 decimals (e.g. IQD) still
// stores hundredths; amounts are just shown without them.
// Quantities are integer thousandths ("milli"): 1 piece = 1000, 0.25 kg = 250.

export interface MoneyFormat {
  currency: string;
  decimals: 0 | 2;
}

// Currencies written as a symbol before the amount; all others get their
// code after it ("12,500 IQD").
const PREFIX_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", TRY: "₺" };

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatNumber(value: number, decimals: number): string {
  const negative = value < 0;
  const [whole, frac] = Math.abs(value).toFixed(decimals).split(".");
  return `${negative ? "-" : ""}${group(whole)}${frac ? `.${frac}` : ""}`;
}

export function formatMoney(cents: number, { currency, decimals }: MoneyFormat): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const amount = decimals === 2 ? `${group(String(Math.floor(abs / 100)))}.${String(abs % 100).padStart(2, "0")}` : group(String(Math.round(abs / 100)));
  const symbol = PREFIX_SYMBOLS[currency];
  const text = symbol ? `${symbol}${amount}` : `${amount} ${currency}`;
  // The minus sign stays with the number, and the whole stays left-to-right
  // inside right-to-left text.
  return `⁦${negative ? "-" : ""}${text}⁩`;
}

// What the cashier typed ("12.5", "1,250", "١٢٫٥") → cents, or null.
export function parseMoney(input: string, decimals: 0 | 2): number | null {
  const normalised = toLatinDigits(input).replace(/[\s,]/g, "").replace("٫", ".");
  if (!/^\d{1,12}(\.\d{0,2})?$/.test(normalised)) return null;
  if (decimals === 0 && normalised.includes(".") && !/\.0*$/.test(normalised)) return null;
  const [whole, frac = ""] = normalised.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

export const MILLI = 1000;

export function formatQuantity(milli: number): string {
  const whole = Math.trunc(milli / MILLI);
  const frac = String(Math.abs(milli % MILLI)).padStart(3, "0").replace(/0+$/, "");
  const sign = milli < 0 && whole === 0 ? "-" : "";
  return `${sign}${group(String(whole))}${frac ? `.${frac}` : ""}`;
}

export function parseQuantity(input: string): number | null {
  const normalised = toLatinDigits(input).replace(/\s/g, "").replace("٫", ".").replace(",", ".");
  if (!/^\d{1,9}(\.\d{0,3})?$/.test(normalised)) return null;
  const [whole, frac = ""] = normalised.split(".");
  return Number(whole) * MILLI + Number(frac.padEnd(3, "0").slice(0, 3));
}

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits → 0-9.
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

// ---- Dates, in the shop's time zone ---------------------------------------

export const DEFAULT_TIME_ZONE = "Asia/Baghdad";

export interface Clock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const partFormatters = new Map<string, Intl.DateTimeFormat>();

// The wall-clock time in `timeZone` (numbers only, which every ICU agrees on).
export function clockIn(ms: number, timeZone: string): Clock {
  let f = partFormatters.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
    } catch {
      f = new Intl.DateTimeFormat("en-US", { timeZone: DEFAULT_TIME_ZONE, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
    }
    partFormatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
}

// The moment a calendar day starts in `timeZone` (ms). Days are "YYYY-MM-DD".
export function dayStart(day: string, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let at = guess;
  // Two passes settle the zone's offset (also across a clock change).
  for (let i = 0; i < 2; i++) {
    const c = clockIn(at, timeZone);
    const shown = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
    at -= shown - guess;
  }
  return at;
}

// Today's date ("YYYY-MM-DD") in `timeZone`.
export function dayOf(ms: number, timeZone: string): string {
  const c = clockIn(ms, timeZone);
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

export function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// "17 Nov 2026" (month name in the language).
export function formatDate(ms: number, lang: Lang, timeZone: string): string {
  const c = clockIn(ms, timeZone);
  return `${c.day} ${MESSAGES[lang].months[c.month - 1]} ${c.year}`;
}

// "14:05"
export function formatTime(ms: number, timeZone: string): string {
  const c = clockIn(ms, timeZone);
  return `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
}

export function formatDateTime(ms: number, lang: Lang, timeZone: string): string {
  return `${formatDate(ms, lang, timeZone)}, ${formatTime(ms, timeZone)}`;
}
