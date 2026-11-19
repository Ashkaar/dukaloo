"use client";

import { BanknoteIcon, CreditCardIcon, NotebookPenIcon, PlusIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { sendJson } from "@/lib/clientApi";
import { enqueue, isNetworkError } from "@/lib/outbox";
import { PAYMENT_METHODS, SALE_METHODS, settle, type Sale, type SaleDiscount, type SaleMethod } from "@/lib/sale";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n-provider";
import { MoneyInput } from "../money-input";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import type { CartLine } from "./till";

const ICONS: Record<SaleMethod, typeof BanknoteIcon> = { cash: BanknoteIcon, card: CreditCardIcon, transfer: SmartphoneIcon, credit: NotebookPenIcon };

export interface NewSaleBody {
  clientId: string;
  lines: CartLine[];
  discount: SaleDiscount | null;
  payments: { method: SaleMethod; cents: number }[];
  note: string;
  customerId: number | null;
  expectedTotalCents: number;
}

interface Row {
  key: number;
  method: SaleMethod;
  cents: number | null;
}

let nextKey = 0;

function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

// Taking payment. One or more payments (cash, card, transfer) may share the
// total; change can only come from cash.
export function PayDialog({
  cart,
  discount,
  customerId,
  creditEnabled = false,
  totalCents,
  onClose,
  onDone,
  onError,
  onOffline,
}: {
  cart: CartLine[];
  discount: SaleDiscount | null;
  customerId: number | null;
  // The shop sells on account (needs a customer on the sale).
  creditEnabled?: boolean;
  totalCents: number;
  onClose: () => void;
  onDone: (sale: Sale) => void;
  onError: (err: unknown) => void;
  // The connection is down: the sale was kept on this device to send later.
  onOffline: (sale: NewSaleBody) => void;
}) {
  const { t, money } = useI18n();
  // Made once for this payment, so a retry never records the sale twice.
  const [clientId] = useState(newClientId);
  const [rows, setRows] = useState<Row[]>([{ key: ++nextKey, method: "cash", cents: totalCents }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = rows.every((r) => r.cents !== null);
  const payments = rows.map((r) => ({ method: r.method, cents: r.cents ?? 0 }));
  const paid = payments.reduce((s, p) => s + p.cents, 0);
  const outcome = valid ? settle(totalCents, payments.filter((p) => p.cents > 0)) : null;
  const remaining = Math.max(0, totalCents - paid);
  const nonCashOver = payments.filter((p) => p.method !== "cash").reduce((s, p) => s + p.cents, 0) > totalCents;

  const setRow = (key: number, change: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));

  // One tap: pay everything with this method.
  const methods: readonly SaleMethod[] = creditEnabled ? SALE_METHODS : PAYMENT_METHODS;
  const usable = (m: SaleMethod) => m !== "credit" || customerId !== null;
  const payAllWith = (method: SaleMethod) => setRows([{ key: ++nextKey, method, cents: totalCents }]);

  const split = () => {
    const used = new Set(rows.map((r) => r.method));
    const method = methods.find((m) => !used.has(m) && usable(m)) ?? "card";
    setRows((list) => [...list, { key: ++nextKey, method, cents: remaining }]);
  };

  const complete = async () => {
    if (!outcome) return;
    setBusy(true);
    const body: NewSaleBody = {
      clientId,
      lines: cart,
      discount,
      payments: payments.filter((p) => p.cents > 0),
      note: note.trim(),
      customerId,
      expectedTotalCents: totalCents,
    };
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      const { sale } = await sendJson<{ sale: Sale }>("/api/sales", "POST", body);
      onDone(sale);
    } catch (err) {
      if (isNetworkError(err)) {
        // Keep it on this device; it goes to the server when the connection is back.
        await enqueue("sale", "/api/sales", { ...body, offline: true });
        onOffline(body);
        return;
      }
      setBusy(false);
      onError(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md" closeLabel={busy ? undefined : t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.till.payTitle}</DialogTitle>
          <DialogDescription className="sr-only">{t.till.payTitle}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-muted px-4 py-3 text-center">
          <p className="text-xs font-medium text-muted-foreground">{t.till.total}</p>
          <p className="tabular text-3xl font-extrabold">{money(totalCents)}</p>
        </div>

        <div className={cn("grid gap-2", methods.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
          {methods.map((m) => {
            const Icon = ICONS[m];
            const only = rows.length === 1 && rows[0].method === m && rows[0].cents === totalCents;
            return (
              <Button key={m} variant={only ? "default" : "outline"} className="h-14 flex-col gap-1" disabled={!usable(m)} onClick={() => payAllWith(m)}>
                <Icon className="size-5" />
                <span className="text-xs">{t.till.methods[m]}</span>
              </Button>
            );
          })}
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <select
                value={r.method}
                onChange={(e) => setRow(r.key, { method: e.target.value as SaleMethod })}
                aria-label={t.till.method}
                className="h-11 cursor-pointer rounded-lg border border-input bg-card px-2 text-sm"
              >
                {methods.filter(usable).map((m) => (
                  <option key={m} value={m}>
                    {t.till.methods[m]}
                  </option>
                ))}
              </select>
              <div className="flex-1">
                <MoneyInput cents={r.cents ?? 0} onChange={(c) => setRow(r.key, { cents: c })} aria-label={`${t.till.received} ${t.till.methods[r.method]}`} className="h-11 text-base" />
              </div>
              {rows.length > 1 && (
                <Button variant="ghost" size="icon" aria-label={t.till.remove} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}>
                  <XIcon />
                </Button>
              )}
            </div>
          ))}
          {rows.length < 3 && remaining > 0 && (
            <Button variant="soft" size="sm" onClick={split}>
              <PlusIcon />
              {t.till.split}
            </Button>
          )}
        </div>

        {creditEnabled && customerId === null && <p className="text-xs text-muted-foreground">{t.credit.chooseCustomer}</p>}
        <div className="space-y-1 text-sm">
          {remaining > 0 && (
            <p className="flex justify-between font-semibold text-red-600 dark:text-red-400">
              <span>{t.till.remaining}</span>
              <span className="tabular">{money(remaining)}</span>
            </p>
          )}
          {outcome && outcome.changeCents > 0 && (
            <p className="flex justify-between text-lg font-bold text-primary">
              <span>{t.till.change}</span>
              <span className="tabular">{money(outcome.changeCents)}</span>
            </p>
          )}
          {nonCashOver && <p className="text-red-600 dark:text-red-400">{t.till.nonCashOver}</p>}
        </div>

        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.till.note} aria-label={t.till.note} maxLength={200} />

        <Button size="touch" className={cn("w-full")} disabled={!outcome || busy} onClick={complete}>
          {busy ? t.till.completing : t.till.complete}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
