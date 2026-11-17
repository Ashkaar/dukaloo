import { LANG_COOKIE, type Lang } from "@/lib/i18n";

// Saves the language on this device (all shops on it) for a year. The
// caller refreshes the page so the server renders in the new language.
export function saveLanguage(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
