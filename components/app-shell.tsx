"use client";

import { EllipsisIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Section, Viewer } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";
import { isActive, navItems } from "./nav";
import { OfflineSync, OutboxStatus } from "./offline-sync";
import { useAppPathname, useShop } from "./shop-provider";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { UpdatesBell } from "./updates-bell";
import { UserMenu } from "./user-menu";

// The frame around every signed-in screen.
// - Tablets and computers: a sidebar on the start side (left, or right in
//   Kurdish and Arabic) with the shop's logo and the sections, Settings
//   pinned at its foot; the bell and the account menu sit in the top bar at
//   the end corner (top right, or top left in Kurdish and Arabic).
// - Phones: a slim top bar, and a bottom bar with the main sections plus
//   "More" for the rest.
export function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const { t } = useI18n();
  const items = navItems(viewer.sections, t);
  const settings = items.find((i) => i.section === "settings");
  const sideItems = items.filter((i) => i !== settings);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {t.nav.skipToContent}
      </a>
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-sidebar-border bg-sidebar md:flex lg:w-64">
        <ShopMark className="h-14 shrink-0 border-b border-sidebar-border px-4" compact />
        <nav aria-label={t.nav.main} className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {sideItems.map((item) => (
            <SideLink key={item.section} {...item} />
          ))}
        </nav>
        {settings && (
          <div className="border-t border-sidebar-border px-3 py-3">
            <SideLink {...settings} />
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-4 backdrop-blur md:hidden">
          <ShopMark className="min-w-0 flex-1" compact />
          <OutboxStatus />
          <UpdatesBell />
          <UserMenu viewer={viewer} compact />
        </header>
        <header className="no-print sticky top-0 z-30 hidden h-14 items-center justify-end gap-2 border-b border-border bg-background/90 px-6 backdrop-blur md:flex">
          <OutboxStatus />
          <UpdatesBell />
          <UserMenu viewer={viewer} compact showName />
        </header>
        <main id="content" className="flex-1 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      <BottomBar sections={viewer.sections} />
      <OfflineSync sections={viewer.sections} />
    </div>
  );
}

function ShopMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { name, branch, logoUrl, href } = useShop();
  return (
    <Link href={href("/dashboard")} className={cn("flex items-center gap-3", className)}>
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground", compact ? "size-8" : "size-10")}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the logo is served by Ariloo
          <img src={logoUrl} alt="" className="size-full object-cover" />
        ) : (
          <StoreIcon className={compact ? "size-4" : "size-5"} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold leading-tight">{name}</span>
        {branch && <span className="block truncate text-xs text-muted-foreground">{branch}</span>}
      </span>
    </Link>
  );
}

function SideLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  const path = useAppPathname();
  const shop = useShop();
  const active = isActive(path, href);
  return (
    <Link
      href={shop.href(href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-highlight hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function BottomBar({ sections }: { sections: readonly Section[] }) {
  const { t } = useI18n();
  const path = useAppPathname();
  const shop = useShop();
  const [more, setMore] = useState(false);
  const items = navItems(sections, t);
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const rest = items.filter((i) => !primary.includes(i));
  const restActive = rest.some((i) => isActive(path, i.href));

  const tab = (active: boolean) =>
    cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground");

  return (
    <nav
      aria-label={t.nav.main}
      className="no-print fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {primary.map(({ section, href, label, icon: Icon }) => (
        <Link key={section} href={shop.href(href)} className={tab(isActive(path, href))} aria-current={isActive(path, href) ? "page" : undefined}>
          <Icon className="size-5" />
          <span className="max-w-full truncate px-1">{label}</span>
        </Link>
      ))}
      {rest.length > 0 && (
        <Sheet open={more} onOpenChange={setMore}>
          <button type="button" className={cn(tab(restActive), "cursor-pointer")} onClick={() => setMore(true)}>
            <EllipsisIcon className="size-5" />
            <span>{t.nav.more}</span>
          </button>
          <SheetContent side="bottom" closeLabel={t.common.close} className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetTitle className="px-2">{t.nav.more}</SheetTitle>
            <div className="grid grid-cols-3 gap-2">
              {rest.map(({ section, href, label, icon: Icon }) => (
                <Link
                  key={section}
                  href={shop.href(href)}
                  onClick={() => setMore(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center text-sm font-medium",
                    isActive(path, href) ? "border-primary bg-primary-soft text-primary-soft-foreground" : "hover:bg-highlight",
                  )}
                >
                  <Icon className="size-6" />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
