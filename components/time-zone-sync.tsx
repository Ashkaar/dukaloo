"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEVICE, TZ_COOKIE } from "@/lib/timeZone";
import { useShop } from "./shop-provider";

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

// Tells the server this device's time zone (a cookie for a year). When the
// shop follows each device's zone and the page was drawn in another one
// (the very first visit, or the device moved), the page is drawn again.
export function TimeZoneSync() {
  const { timeZone, timeZoneSetting } = useShop();
  const router = useRouter();
  useEffect(() => {
    const zone = deviceTimeZone();
    if (!zone) return;
    const current = document.cookie.split("; ").find((c) => c.startsWith(`${TZ_COOKIE}=`))?.slice(TZ_COOKIE.length + 1);
    if (current !== encodeURIComponent(zone)) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    }
    if (timeZoneSetting === DEVICE && zone !== timeZone) {
      // Once per zone per tab, so a zone the server doesn't know can't loop.
      try {
        if (sessionStorage.getItem(TZ_COOKIE) === zone) return;
        sessionStorage.setItem(TZ_COOKIE, zone);
      } catch {
        return;
      }
      router.refresh();
    }
  }, [timeZone, timeZoneSetting, router]);
  return null;
}
