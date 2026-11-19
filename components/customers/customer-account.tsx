"use client";

import { HandCoinsIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import type { CustomerPayment } from "@/lib/customers";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/sale";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { MoneyInput } from "../money-input";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { AccountInfo } from "./customer-page";

type Account = { balanceCents: number; payments: CustomerPayment[] };

function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

// What a customer owes from credit sales, and the payments they've made.
export function CustomerAccount({ customerId, initial }: { customerId: number; initial: AccountInfo }) {
  const { t, money, dateTime } = useI18n();
  const [account, setAccount] = useState<Account>({ balanceCents: initial.balanceCents, payments: initial.payments });
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState<CustomerPayment | null>(null);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t.credit.account}</CardTitle>
          <p className={cn("tabular mt-2 text-3xl font-extrabold", account.balanceCents > 0 && "text-accent-700 dark:text-accent-400")}>{money(Math.max(0, account.balanceCents))}</p>
          <p className="text-xs text-muted-foreground">{account.balanceCents > 0 ? t.credit.owedNow : account.balanceCents < 0 ? t.credit.inCredit(money(-account.balanceCents)) : t.credit.nothingOwed}</p>
        </div>
        <Button onClick={() => setPaying(true)} disabled={account.balanceCents <= 0 && !initial.creditEnabled}>
          <HandCoinsIcon />
          {t.credit.recordPayment}
        </Button>
      </CardHeader>
      {account.payments.length > 0 && (
        <CardContent className="p-0 pb-2">
          <p className="px-5 pb-1 text-xs font-semibold text-muted-foreground">{t.credit.payments}</p>
          <ul className="divide-y divide-border">
            {account.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{[dateTime(p.at), t.till.methods[p.method], p.note, p.staffName].filter(Boolean).join(" · ")}</span>
                <span className="tabular font-semibold">{money(p.amountCents)}</span>
                {initial.canDelete && (
                  <Button variant="destructive-ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setDeleting(p)}>
                    <Trash2Icon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
      {paying && (
        <PaymentDialog
          customerId={customerId}
          owed={account.balanceCents}
          onClose={() => setPaying(false)}
          onSaved={(a) => {
            setAccount(a);
            setPaying(false);
            toast.success(t.credit.paymentSaved);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t.credit.deletePayment}
        description={deleting ? money(deleting.amountCents) : ""}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          setAccount(await sendJson<Account>(`/api/customers/${customerId}/payments/${deleting!.id}`, "DELETE"));
          setDeleting(null);
        }}
      />
    </Card>
  );
}

function PaymentDialog({ customerId, owed, onClose, onSaved }: { customerId: number; owed: number; onClose: () => void; onSaved: (a: Account) => void }) {
  const { t, money } = useI18n();
  const [clientId] = useState(newClientId);
  const [amount, setAmount] = useState<number | null>(Math.max(0, owed));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return setError(t.expenses.amountNeeded);
    setBusy(true);
    setError(null);
    try {
      onSaved(await sendJson<Account>(`/api/customers/${customerId}/payments`, "POST", { clientId, amountCents: amount, method, note: note.trim() }));
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.credit.recordPayment}</DialogTitle>
          <DialogDescription>{owed > 0 ? t.credit.owes(money(owed)) : t.credit.nothingOwed}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-amount">{t.expenses.amount}</Label>
            <MoneyInput id="cp-amount" cents={Math.max(0, owed)} onChange={setAmount} className="h-11 text-lg" autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn("h-10 cursor-pointer rounded-lg border text-xs font-medium", method === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-highlight")}
              >
                {t.till.methods[m]}
              </button>
            ))}
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.expenses.note} aria-label={t.expenses.note} maxLength={200} />
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
