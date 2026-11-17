"use client";

import { useCallback, useSyncExternalStore } from "react";

// Light, dark or follow the device. Saved per device; applied before first
// paint by THEME_INIT_SCRIPT (in the root layout) so there's no flash.

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "dukaloo-theme";

export const THEME_INIT_SCRIPT = `(() => {
  try {
    var s = localStorage.getItem('${KEY}');
    var dark = s === 'dark' || (s !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (_) {}
})();`;

const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    const s = localStorage.getItem(KEY);
    return s === "light" || s === "dark" ? s : "system";
  } catch {
    return "system";
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (read() === "system") apply("system");
  };
  media.addEventListener("change", onMedia);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMedia);
  };
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);
  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    apply(next);
    listeners.forEach((l) => l());
  }, []);
  return [choice, setChoice];
}
