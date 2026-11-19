"use client";

import { MinusIcon, PlusIcon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DECIMAL_UNITS, type Unit } from "@/lib/catalog";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { MILLI } from "@/lib/format";
import { PAYMENT_METHODS, refundFor, type Sale, type SaleMethod } from "@/lib/sale";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { QuantityInput } from "../money-input";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

// Giving items back from a sale. The refund shown is worked out the same
// way the server records it (each line's share of what was paid).
export function ReturnDialog({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: (sale: Sale) => void }) {
  const { t, money, quantity } = useI18n();
  const { decimals } = useShop();
  const [clientId] = useState(newClientId);
  const [qty, setQty] = useState<Record<number, number | null>>({});
  // A sale paid on account refunds to the account by default.
  const [method, setMethod] = useState<SaleMethod>(sale.payments.some((p) => p.method === "credit") && sale.customerId ? "credit" : (sale.payments[0]?.method ?? "cash"));
  const methods: readonly SaleMethod[] = sale.customerId ? [...PAYMENT_METHODS, "credit"] : PAYMENT_METHODS;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = sale.lines.filter((l) => l.qtyMilli - l.returnedMilli > 0);
  const chosen = open.map((l) => ({ line: l, qty: qty[l.id] ?? 0 })).filter((x) => x.qty !== null && x.qty > 0) as { line: Sale["lines"][number]; qty: number }[];
  const invalid = open.some((l) => qty[l.id] === null || (qty[l.id] ?? 0) > l.qtyMilli - l.returnedMilli);
  const refund = Math.min(
    chosen.reduce((s, { line, qty: q }) => s + refundFor(sale, line, line.returnedMilli + q, decimals) - refundFor(sale, line, line.returnedMilli, decimals), 0),
    sale.totalCents - sale.refundedCents,
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { sale: updated } = await sendJson<{ sale: Sale }>(`/api/sales/${sale.id}/returns`, "POST", {
        clientId,
        lines: chosen.map(({ line, qty: q }) => ({ saleLineId: line.id, qtyMilli: q })),
        method,
        note: note.trim(),
      });
      toast.success(t.returns.done(money(updated.refundedCents - sale.refundedCents)));
      onDone(updated);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.returns.title(sale.number)}</DialogTitle>
          <DialogDescription>{t.returns.intro}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {open.map((l) => {
            const left = l.qtyMilli - l.returnedMilli;
            const value = qty[l.id] ?? 0;
            const decimal = DECIMAL_UNITS.includes(l.unit as Unit);
            const name = [l.name, l.variantLabel].filter(Boolean).join(" · ");
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{t.returns.canReturn(quantity(left))}</p>
                </div>
                {decimal ? (
                  <QuantityInput milli={0} onChange={(m) => setQty((q) => ({ ...q, [l.id]: m }))} aria-label={`${t.returns.qty} ${name}`} className="h-9 w-24" />
                ) : (
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon-sm" aria-label={`${t.till.less} ${name}`} disabled={value <= 0} onClick={() => setQty((q) => ({ ...q, [l.id]: Math.max(0, value - MILLI) }))}>
                      <MinusIcon />
                    </Button>
                    <span className="tabular w-8 text-center text-sm font-semibold">{quantity(value)}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`${t.till.more} ${name}`} disabled={value + MILLI > left} onClick={() => setQty((q) => ({ ...q, [l.id]: value + MILLI }))}>
                      <PlusIcon />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="refund-method">{t.returns.refundBy}</Label>
            <select
              id="refund-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as SaleMethod)}
              className="h-10 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-sm"
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {t.till.methods[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-end">
            <p className="text-xs text-muted-foreground">{t.returns.refund}</p>
            <p className="tabular text-xl font-extrabold">{money(refund)}</p>
          </div>
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.returns.reason} aria-label={t.returns.reason} maxLength={200} />
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit} disabled={busy || invalid || chosen.length === 0}>
            <Undo2Icon />
            {t.returns.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
