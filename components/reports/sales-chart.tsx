"use client";

import { useState } from "react";
import { useI18n } from "../i18n-provider";

// Net sales per day: one series, so one colour and no legend (the card's
// title names it). Thin bars with rounded tops on the baseline, 2px gaps, a
// recessive grid, and a tooltip on each bar (hit area the full column).
export function SalesChart({ days }: { days: { day: string; netCents: number; count: number }[] }) {
  const { t, money } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.netCents));
  // A round top for the scale: 1, 2 or 5 times a power of ten.
  const pow = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= max) ?? max;
  const height = 180;
  const label = (day: string) => `${Number(day.slice(8))} ${t.months[Number(day.slice(5, 7)) - 1]}`;
  // Inside one month the axis only needs the day number.
  const oneMonth = days.length > 0 && days[0].day.slice(0, 7) === days[days.length - 1].day.slice(0, 7);
  const tick = (day: string) => (oneMonth ? String(Number(day.slice(8))) : label(day));
  const every = Math.ceil(days.length / (days.length <= 31 && days[0]?.day.slice(0, 7) === days[days.length - 1]?.day.slice(0, 7) ? 11 : 7));

  return (
    <div className="relative" dir="ltr">
      <div className="flex gap-2">
        <div className="tabular flex w-16 flex-col justify-between py-0 text-end text-[11px] text-muted-foreground" style={{ height }}>
          <span>{money(top)}</span>
          <span>{money(top / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border" style={{ top: height / 2 }} />
          <div className="flex items-end" style={{ height, gap: days.length > 40 ? 1 : 2 }}>
            {days.map((d, i) => (
              <div
                key={d.day}
                className="relative flex h-full min-w-0 flex-1 cursor-default items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(i)}
                aria-label={`${label(d.day)}: ${money(d.netCents)}`}
              >
                <div
                  className="w-full rounded-t-[4px] bg-brand-600 transition-opacity dark:bg-brand-500"
                  style={{ height: `${(Math.max(0, d.netCents) / top) * 100}%`, minHeight: d.netCents > 0 ? 2 : 0, opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ top: height }} />
          <div className="mt-1.5 flex text-[11px] text-muted-foreground">
            {days.map((d, i) => (
              <span key={d.day} className="min-w-0 flex-1 truncate text-center">
                {i % every === 0 ? tick(d.day) : ""}
              </span>
            ))}
          </div>
          {hover !== null && days[hover] && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-3 py-2 text-xs whitespace-nowrap shadow-lg"
              style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
            >
              <p className="font-semibold">{label(days[hover].day)}</p>
              <p className="tabular">{money(days[hover].netCents)}</p>
              <p className="text-muted-foreground">{t.reports.salesCount(days[hover].count)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
