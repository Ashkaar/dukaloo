"use client";

import { BanknoteIcon, ChevronLeftIcon, ChevronRightIcon, CreditCardIcon, PrinterIcon, ReceiptTextIcon, SmartphoneIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, getJson, sendJson } from "@/lib/clientApi";
import { nextDay } from "@/lib/format";
import type { PaymentMethod, Sale, SaleSummary, SalesSettings } from "@/lib/sale";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../confirm-dialog";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { printReceipt } from "./print-receipt";

export interface DayOfSales {
  day: string;
  sales: SaleSummary[];
  totals: { count: number; totalCents: number; byMethod: Record<PaymentMethod, number> };
}

const ICONS: Record<PaymentMethod, typeof BanknoteIcon> = { cash: BanknoteIcon, card: CreditCardIcon, transfer: SmartphoneIcon };

const previousDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

export function SalesList({ first, today, settings, canVoid }: { first: DayOfSales; today: string; settings: SalesSettings; canVoid: boolean }) {
  const i18n = useI18n();
  const { t, money, time } = i18n;
  const shop = useShop();
  const [data, setData] = useState(first);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Sale | null>(null);

  const load = async (day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    setLoading(true);
    try {
      setData(await getJson<DayOfSales>(`/api/sales?day=${day}`));
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setLoading(false);
    }
  };

  const show = async (id: number) => {
    try {
      setOpen((await getJson<{ sale: Sale }>(`/api/sales/${id}`)).sale);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  return (
    <PageBody>
      <PageHeader title={t.sales.title} description={t.sales.intro}>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={t.sales.previous} onClick={() => load(previousDay(data.day))}>
            <ChevronLeftIcon className="rtl:-scale-x-100" />
          </Button>
          <Input type="date" value={data.day} max={today} onChange={(e) => load(e.target.value)} aria-label={t.sales.day} className="w-40" dir="ltr" />
          <Button variant="outline" size="icon" aria-label={t.sales.next} disabled={data.day >= today} onClick={() => load(nextDay(data.day))}>
            <ChevronRightIcon className="rtl:-scale-x-100" />
          </Button>
          {data.day !== today && (
            <Button variant="ghost" onClick={() => load(today)}>
              {t.sales.today}
            </Button>
          )}
        </div>
      </PageHeader>

      <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-5", loading && "opacity-60")}>
        <Stat label={t.sales.total} value={money(data.totals.totalCents)} strong />
        <Stat label={t.sales.countLabel} value={String(data.totals.count)} />
        {(["cash", "card", "transfer"] as const).map((m) => {
          const Icon = ICONS[m];
          return <Stat key={m} label={t.till.methods[m]} value={money(data.totals.byMethod[m])} icon={<Icon className="size-4" />} />;
        })}
      </div>

      {data.sales.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <ReceiptTextIcon className="size-10 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">{t.sales.none}</p>
        </Card>
      ) : (
        <Card className={cn("divide-y divide-border", loading && "opacity-60")}>
          {data.sales.map((s) => (
            <button key={s.id} type="button" onClick={() => show(s.id)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-start hover:bg-highlight sm:px-5">
              <span className="tabular w-14 shrink-0 text-sm text-muted-foreground">{time(s.at)}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  #{s.number}
                  {s.status === "voided" && <Badge variant="destructive">{t.sales.voided}</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[t.sales.items(s.itemCount), s.staffName || t.header.owner, s.methods.map((m) => t.till.methods[m]).join(" + ")].join(" · ")}
                </p>
              </div>
              <span className={cn("tabular font-bold", s.status === "voided" && "text-muted-foreground line-through")}>{money(s.totalCents)}</span>
            </button>
          ))}
        </Card>
      )}

      {open && (
        <SaleDialog
          sale={open}
          canVoid={canVoid}
          onClose={() => setOpen(null)}
          onPrint={(sale) => printReceipt(sale, { ...i18n, shopName: shop.name, branch: shop.branch, settings })}
          onVoided={(sale) => {
            setOpen(sale);
            load(data.day);
          }}
        />
      )}
    </PageBody>
  );
}

function Stat({ label, value, strong = false, icon }: { label: string; value: string; strong?: boolean; icon?: React.ReactNode }) {
  return (
    <Card className="px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn("tabular mt-1 truncate font-bold", strong ? "text-2xl" : "text-lg")}>{value}</p>
    </Card>
  );
}

function SaleDialog({ sale, canVoid, onClose, onPrint, onVoided }: { sale: Sale; canVoid: boolean; onClose: () => void; onPrint: (s: Sale) => void; onVoided: (s: Sale) => void }) {
  const { t, money, quantity, dateTime } = useI18n();
  const [voiding, setVoiding] = useState(false);
  const rate = `${sale.taxRateBp / 100}%`;

  const doVoid = async () => {
    const { sale: updated } = await sendJson<{ sale: Sale }>(`/api/sales/${sale.id}/void`, "POST");
    setVoiding(false);
    toast.success(t.sales.voidedToast);
    onVoided(updated);
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent closeLabel={t.common.close}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t.till.receiptNo(sale.number)}
              {sale.status === "voided" && <Badge variant="destructive">{t.sales.voided}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {dateTime(sale.at)} · {sale.staffName || t.header.owner}
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {sale.lines.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{[l.name, l.variantLabel].filter(Boolean).join(" · ")}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {quantity(l.qtyMilli)} × {money(l.unitPriceCents)}
                    {l.discountCents > 0 && ` · -${money(l.discountCents)}`}
                  </p>
                </div>
                <span className="tabular font-semibold">{money(l.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 text-sm">
            <Line label={t.receipt.subtotal} value={money(sale.subtotalCents)} />
            {sale.discountCents > 0 && <Line label={t.receipt.discount} value={`-${money(sale.discountCents)}`} />}
            {sale.taxCents > 0 && !sale.taxInclusive && <Line label={`${sale.taxName} ${rate}`} value={money(sale.taxCents)} />}
            <Line label={t.receipt.total} value={money(sale.totalCents)} strong />
            {sale.taxCents > 0 && sale.taxInclusive && <Line label={t.receipt.taxIncluded(sale.taxName, rate)} value={money(sale.taxCents)} />}
            <div className="pt-2" />
            {sale.payments.map((p, i) => (
              <Line key={i} label={t.till.methods[p.method]} value={money(p.cents)} />
            ))}
            {sale.changeCents > 0 && <Line label={t.receipt.change} value={money(sale.changeCents)} />}
            {sale.note && <p className="pt-2 text-muted-foreground">{sale.note}</p>}
          </div>
          <DialogFooter className="sm:justify-between">
            {canVoid && sale.status === "done" ? (
              <Button variant="destructive-ghost" onClick={() => setVoiding(true)}>
                <XCircleIcon />
                {t.sales.void}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={() => onPrint(sale)}>
              <PrinterIcon />
              {t.till.print}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={t.sales.voidTitle(sale.number)}
        description={t.sales.voidText}
        confirmLabel={t.sales.void}
        destructive
        onConfirm={doVoid}
      />
    </>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={cn("flex justify-between", strong ? "text-base font-bold" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </p>
  );
}
