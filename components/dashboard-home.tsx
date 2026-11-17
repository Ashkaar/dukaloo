"use client";

import { ArrowUpRightIcon, CheckCircle2Icon, CircleDashedIcon, CreditCardIcon } from "lucide-react";
import Link from "next/link";
import { GRACE_MS, type PlanId, type ShopState } from "@/lib/shopState";
import type { Viewer } from "@/lib/sections";
import { useI18n } from "./i18n-provider";
import { navItems } from "./nav";
import { PageBody, PageHeader } from "./page-header";
import { useShop } from "./shop-provider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export interface Subscription {
  state: ShopState;
  plan: PlanId | null;
  trialEndsAt: number | null;
  paidUntil: number | null;
  accountUrl: string;
}

export function DashboardHome({ viewer, subscription }: { viewer: Viewer; subscription: Subscription | null }) {
  const { t, date } = useI18n();
  const shop = useShop();
  const shortcuts = navItems(viewer.sections, t).filter((i) => i.section !== "dashboard");

  return (
    <PageBody>
      <PageHeader title={viewer.kind === "owner" ? t.dashboard.helloOwner : t.dashboard.hello(viewer.name)} description={t.dashboard.intro} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {shortcuts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.dashboard.shortcuts}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {shortcuts.map(({ section, href, label, icon: Icon }) => (
                  <Link
                    key={section}
                    href={shop.href(href)}
                    className="group flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-semibold">{label}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {viewer.kind === "owner" && (
            <Card>
              <CardHeader>
                <CardTitle>{t.dashboard.gettingStarted}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm">
                  {[t.dashboard.stepStaff, t.dashboard.stepSettings].map((step) => (
                    <li key={step} className="flex items-start gap-3">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      {step}
                    </li>
                  ))}
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <CircleDashedIcon className="mt-0.5 size-4 shrink-0" />
                    {t.dashboard.stepSoon}
                  </li>
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {subscription && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="size-4 text-muted-foreground" />
                {t.dashboard.subscription}
              </CardTitle>
              <Badge variant={subscription.state === "grace" ? "accent" : "default"}>{t.states[subscription.state]}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-bold">{subscription.plan ? t.plans[subscription.plan] : t.plans.none}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {subscription.state === "trial" && subscription.trialEndsAt
                    ? t.dashboard.trialEnds(date(subscription.trialEndsAt))
                    : subscription.state === "grace" && subscription.paidUntil
                      ? t.dashboard.graceUntil(date(subscription.paidUntil + GRACE_MS))
                      : subscription.paidUntil
                        ? t.dashboard.paidUntil(date(subscription.paidUntil))
                        : null}
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={subscription.accountUrl}>
                  {t.dashboard.manage}
                  <ArrowUpRightIcon className="rtl:-scale-x-100" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PageBody>
  );
}
