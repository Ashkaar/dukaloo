"use client";

import { ArrowUpRightIcon, KeyRoundIcon, LockIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendJson } from "@/lib/clientApi";
import { LANG_CODES, LANGUAGES, type Lang } from "@/lib/i18n";
import type { Viewer } from "@/lib/sections";
import type { PlanId, ShopState } from "@/lib/shopState";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";
import { saveLanguage } from "./language";
import { PageBody, PageHeader } from "./page-header";
import { useShop } from "./shop-provider";
import { useTheme, type ThemeChoice } from "./theme";
import { TimeZoneCard } from "./time-zone-card";
import { SellingCard } from "./selling-card";
import { BackupCard } from "./backup-card";
import type { SalesSettings } from "@/lib/sale";
import type { Feature } from "@/lib/plans";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export interface ShopFacts {
  name: string;
  branch: string;
  currency: string;
  plan: PlanId | null;
  state: ShopState | null;
  accountUrl: string | null;
}

export function SettingsScreen({ viewer, shop, selling, features = [] }: { viewer: Viewer; shop: ShopFacts; selling: SalesSettings; features?: readonly Feature[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { href } = useShop();
  const [theme, setTheme] = useTheme();

  const choose = (next: Lang) => {
    saveLanguage(next);
    router.refresh();
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

  const option = (selected: boolean) =>
    cn(
      "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
      selected ? "border-primary bg-primary-soft text-primary-soft-foreground ring-1 ring-primary" : "border-border hover:bg-highlight",
    );

  const themes: { value: ThemeChoice; label: string; icon: typeof SunIcon }[] = [
    { value: "light", label: t.header.light, icon: SunIcon },
    { value: "dark", label: t.header.dark, icon: MoonIcon },
    { value: "system", label: t.header.system, icon: MonitorIcon },
  ];

  const rows: [string, string][] = [
    [t.settings.shopName, shop.name],
    ...(shop.branch ? ([[t.settings.branch, shop.branch]] as [string, string][]) : []),
    [t.settings.currency, shop.currency],
    ...(shop.state ? ([[t.settings.status, t.states[shop.state]]] as [string, string][]) : []),
    ...(shop.state ? ([[t.settings.plan, shop.plan ? t.plans[shop.plan] : t.plans.none]] as [string, string][]) : []),
  ];

  return (
    <PageBody>
      <PageHeader title={t.settings.title} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.appearance}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t.settings.theme}</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.settings.theme}>
                {themes.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" role="radio" aria-checked={theme === value} className={option(theme === value)} onClick={() => setTheme(value)}>
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t.settings.language}</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.settings.language}>
                {LANG_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={lang === code}
                    lang={LANGUAGES[code].html}
                    dir={LANGUAGES[code].dir}
                    className={option(lang === code)}
                    onClick={() => choose(code)}
                  >
                    {LANGUAGES[code].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t.settings.languageNote}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <SellingCard initial={selling} canChange={viewer.isOwner} creditInPlan={features.includes("credit")} scaleInPlan={features.includes("scale")} />
          <TimeZoneCard canChange={viewer.isOwner} />
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t.settings.shop}</CardTitle>
                {shop.accountUrl && <CardDescription className="mt-1">{t.settings.shopNote}</CardDescription>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-3 py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="truncate font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {shop.accountUrl && viewer.kind === "owner" && (
                <Button asChild variant="outline" className="w-full">
                  <a href={shop.accountUrl}>
                    {t.settings.manage}
                    <ArrowUpRightIcon className="rtl:-scale-x-100" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {viewer.isOwner && <BackupCard />}
          {(viewer.kind === "owner" || viewer.unlocked) && (
            <Card>
              <CardHeader>
                <CardTitle>{t.settings.security}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {viewer.kind === "owner" && (
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link href={href("/owner-password")}>
                      <KeyRoundIcon />
                      {t.settings.changeOwnerPassword}
                    </Link>
                  </Button>
                )}
                {viewer.unlocked && (
                  <Button variant="outline" className="w-full justify-start" onClick={lock}>
                    <LockIcon />
                    {t.settings.lockDevice}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageBody>
  );
}
