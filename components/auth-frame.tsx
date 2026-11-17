"use client";

import { StoreIcon } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { useShop } from "./shop-provider";

// The centred card used by sign-in and the owner password screens, with
// the shop's logo and name from Ariloo.
export function AuthFrame({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  const { name, branch, logoUrl } = useShop();
  const { t } = useI18n();
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-brand-100/80 to-transparent dark:from-brand-950/60"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the logo is served by Ariloo
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <StoreIcon className="size-7" />
            )}
          </div>
          <p className="text-lg font-bold">{name}</p>
          {branch && <p className="text-sm text-muted-foreground">{branch}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-bold">{title}</h1>
          {intro && <p className="mt-1.5 text-sm text-muted-foreground">{intro}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t.app.name} · {t.app.tagline}
        </p>
      </div>
    </main>
  );
}
