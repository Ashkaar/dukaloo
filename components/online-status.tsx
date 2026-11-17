"use client";

import { WifiOffIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "./i18n-provider";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

// Shown only while the device is offline.
export function OnlineStatus() {
  const { t } = useI18n();
  const online = useOnline();
  if (online) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-100 px-2 py-1 text-xs font-semibold text-accent-800 dark:bg-accent-500/15 dark:text-accent-300">
      <WifiOffIcon className="size-3.5" />
      {t.header.offline}
    </span>
  );
}
