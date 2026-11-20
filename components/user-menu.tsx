"use client";

import { ChevronsUpDownIcon, KeyRoundIcon, LanguagesIcon, LockIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, UserRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendJson } from "@/lib/clientApi";
import { LANG_CODES, LANGUAGES, type Lang } from "@/lib/i18n";
import type { Viewer } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";
import { saveLanguage } from "./language";
import { useShop } from "./shop-provider";
import { useTheme, type ThemeChoice } from "./theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// `compact`: the round button in a top bar, its menu opening below. With
// `showName` the name shows beside it (from tablets up).
export function UserMenu({ viewer, compact = false, showName = false, className }: { viewer: Viewer; compact?: boolean; showName?: boolean; className?: string }) {
  const { t, lang } = useI18n();
  const shop = useShop();
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const who = viewer.kind === "owner" ? t.header.owner : viewer.name;

  const signOut = async () => {
    try {
      // Saved screens and data belong to this login: forget them on a shared till.
      navigator.serviceWorker?.controller?.postMessage({ type: "forget" });
      await sendJson("/api/auth/logout", "POST");
    } finally {
      window.location.assign(shop.href("/login"));
    }
  };
  const lock = async () => {
    try {
      await sendJson("/api/unlock", "DELETE");
      toast.success(t.unlock.locked);
      router.refresh();
    } catch {
      toast.error(t.common.somethingWrong);
    }
  };
  const changeLanguage = (next: string) => {
    saveLanguage(next as Lang);
    router.refresh();
  };

  return (
    <DropdownMenu dir={LANGUAGES[lang].dir}>
      <DropdownMenuTrigger
        aria-label={t.header.userMenu}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-lg text-start outline-none transition-colors hover:bg-highlight focus-visible:ring-3 focus-visible:ring-ring/40",
          compact ? (showName ? "py-1 ps-1 pe-2" : "p-1") : "px-2 py-1.5",
          className,
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground">
          {viewer.kind === "owner" ? <UserRoundIcon className="size-4" /> : who.slice(0, 1).toUpperCase()}
        </span>
        {compact && showName && <span className="max-w-40 truncate text-sm font-semibold">{who}</span>}
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{who}</span>
              {viewer.unlocked && <span className="block truncate text-xs text-accent-700 dark:text-accent-400">{t.header.owner}</span>}
            </span>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60">
        <DropdownMenuLabel>{who}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "dark" ? <MoonIcon /> : theme === "light" ? <SunIcon /> : <MonitorIcon />}
            {t.header.theme}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
              <DropdownMenuRadioItem value="light">{t.header.light}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">{t.header.dark}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">{t.header.system}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <LanguagesIcon />
            {t.header.language}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={lang} onValueChange={changeLanguage}>
              {LANG_CODES.map((code) => (
                <DropdownMenuRadioItem key={code} value={code} lang={LANGUAGES[code].html} dir={LANGUAGES[code].dir}>
                  {LANGUAGES[code].label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {viewer.kind === "owner" && (
          <DropdownMenuItem onSelect={() => router.push(shop.href("/owner-password"))}>
            <KeyRoundIcon />
            {t.settings.changeOwnerPassword}
          </DropdownMenuItem>
        )}
        {viewer.unlocked && (
          <DropdownMenuItem onSelect={lock}>
            <LockIcon />
            {t.unlock.lock}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={signOut}>
          <LogOutIcon />
          {t.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
