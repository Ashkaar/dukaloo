"use client";

import { ArrowLeftIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { sendJson } from "@/lib/clientApi";
import type { Purchase } from "@/lib/purchases";
import { ConfirmDialog } from "../confirm-dialog";
import { useI18n } from "../i18n-provider";
import { PageBody } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function PurchaseView({ purchase: initial, canCancel }: { purchase: Purchase; canCancel: boolean }) {
  const { t, money, quantity, dateTime } = useI18n();
  const shop = useShop();
  const [purchase, setPurchase] = useState(initial);
  const [cancelling, setCancelling] = useState(false);

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t.purchases.back}>
          <Link href={shop.href("/dashboard/purchases")}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
          </Link>
        </Button>
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-bold tracking-tight">
          {t.purchases.number(purchase.number)}
          {purchase.status === "cancelled" && <Badge variant="destructive">{t.purchases.cancelled}</Badge>}
        </h1>
        {canCancel && purchase.status === "received" && (
          <Button variant="destructive-ghost" onClick={() => setCancelling(true)}>
            <XCircleIcon />
            {t.purchases.cancel}
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {[dateTime(purchase.at), purchase.supplierName, purchase.reference && `${t.purchases.reference}: ${purchase.reference}`, purchase.staffName || t.header.owner].filter(Boolean).join(" · ")}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {purchase.lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">{[l.name, l.variantLabel].filter(Boolean).join(" · ")}</span>
                  <span className="tabular block text-xs text-muted-foreground">
                    {quantity(l.qtyMilli)} × {money(l.unitCostCents)}
                  </span>
                </span>
                <span className="tabular font-semibold">{money(l.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between">
            <span className="font-bold">{t.till.total}</span>
            <span className="tabular text-2xl font-extrabold">{money(purchase.totalCents)}</span>
          </div>
          {purchase.note && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{purchase.note}</p>}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t.purchases.cancelTitle(purchase.number)}
        description={t.purchases.cancelText}
        confirmLabel={t.purchases.cancel}
        destructive
        onConfirm={async () => {
          const { purchase: p } = await sendJson<{ purchase: Purchase }>(`/api/purchases/${purchase.id}/cancel`, "POST");
          setPurchase(p);
          setCancelling(false);
          toast.success(t.purchases.cancelledToast);
        }}
      />
    </PageBody>
  );
}
