// The time zone dates, times and "today" are worked out in. Client-safe.
//
// The shop chooses in Settings: "device" (the default) follows each
// device's own time zone, or one named zone for every device. A device
// reports its zone in the dukaloo_tz cookie (components/time-zone-sync.tsx),
// so the server formats dates exactly as that browser will.

import { DEFAULT_TIME_ZONE } from "./format";

export const TZ_COOKIE = "dukaloo_tz";
export const DEVICE = "device";
export type TimeZoneSetting = typeof DEVICE | string;

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function normaliseSetting(value: unknown): TimeZoneSetting {
  return value !== DEVICE && isTimeZone(value) ? value : DEVICE;
}

// The zone to use: the shop's chosen one, else this device's, else Baghdad
// (only until the device has reported its zone, on its very first visit).
export function effectiveTimeZone(setting: TimeZoneSetting, deviceZone: string | undefined): string {
  if (setting !== DEVICE) return setting;
  return isTimeZone(deviceZone) ? deviceZone : DEFAULT_TIME_ZONE;
}
