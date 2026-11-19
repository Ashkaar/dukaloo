import "server-only";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { dayOf } from "./format";
import { normaliseSalesSettings, type SalesSettings } from "./sale";
import { shopSettings } from "./db/schema";
import { effectiveTimeZone, normaliseSetting, TZ_COOKIE, type TimeZoneSetting } from "./timeZone";

// Shop settings: one JSON value per key in shop_settings, normalised with
// defaults when read, so older or missing values keep working.

async function readSetting(key: string): Promise<unknown> {
  const db = await getDb();
  const [row] = await db.select().from(shopSettings).where(eq(shopSettings.key, key));
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db
    .insert(shopSettings)
    .values({ key, value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: shopSettings.key, set: { value: sql`excluded.value` } });
}

export async function getTimeZoneSetting(): Promise<TimeZoneSetting> {
  return normaliseSetting(await readSetting("time_zone"));
}

export async function setTimeZoneSetting(value: TimeZoneSetting): Promise<void> {
  await writeSetting("time_zone", normaliseSetting(value));
}

// The zone for this request: the shop's choice, or this device's.
export async function requestTimeZone(): Promise<{ setting: TimeZoneSetting; timeZone: string }> {
  let setting: TimeZoneSetting = "device";
  try {
    setting = await getTimeZoneSetting();
  } catch (err) {
    console.error("Couldn't read the time zone setting:", err);
  }
  const device = (await cookies()).get(TZ_COOKIE)?.value;
  return { setting, timeZone: effectiveTimeZone(setting, device) };
}

export async function getSalesSettings(): Promise<SalesSettings> {
  return normaliseSalesSettings(await readSetting("sales"));
}

export async function setSalesSettings(value: SalesSettings): Promise<void> {
  await writeSetting("sales", normaliseSalesSettings(value));
}

// Today's date in this request's time zone, with the zone.
export async function requestToday(): Promise<{ day: string; timeZone: string }> {
  const { timeZone } = await requestTimeZone();
  return { day: dayOf(Date.now(), timeZone), timeZone };
}
