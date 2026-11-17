"use client";

import { Direction } from "radix-ui";
import { createContext, useContext, useMemo } from "react";
import { formatDate, formatDateTime, formatMoney, formatQuantity, formatTime } from "@/lib/format";
import { applyOverrides, LANGUAGES, MESSAGES, type Dir, type Lang, type Messages, type Overrides } from "@/lib/i18n";
import { useShop } from "./shop-provider";

interface I18n {
  lang: Lang;
  dir: Dir;
  t: Messages;
  money: (cents: number) => string;
  quantity: (milli: number) => string;
  date: (ms: number) => string;
  time: (ms: number) => string;
  dateTime: (ms: number) => string;
}

const I18nContext = createContext<I18n | null>(null);

// The dictionaries hold functions, which can't be sent from the server, so
// the server sends the language and the owner's corrections and the
// dictionary is picked here.
export function I18nProvider({ lang, overrides, children }: { lang: Lang; overrides: Overrides; children: React.ReactNode }) {
  const { currency, decimals, timeZone } = useShop();
  const value = useMemo<I18n>(() => {
    const t = applyOverrides(MESSAGES[lang], overrides);
    const dir = LANGUAGES[lang].dir;
    return {
      lang,
      dir,
      t,
      money: (cents) => formatMoney(cents, { currency, decimals }),
      quantity: (milli) => formatQuantity(milli),
      date: (ms) => formatDate(ms, lang, timeZone),
      time: (ms) => formatTime(ms, timeZone),
      dateTime: (ms) => formatDateTime(ms, lang, timeZone),
    };
  }, [lang, overrides, currency, decimals, timeZone]);
  return (
    <I18nContext.Provider value={value}>
      <Direction.Provider dir={value.dir}>{children}</Direction.Provider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
