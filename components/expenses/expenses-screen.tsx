"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TagsIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { errorMessage, getJson, sendJson } from "@/lib/clientApi";
import { enqueue, isNetworkError } from "@/lib/outbox";
import type { Expense, ExpenseType } from "@/lib/expenses";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/sale";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { MoneyInput } from "../money-input";
import { PageBody, PageHeader } from "../page-header";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { NameListDialog } from "./name-list-dialog";

type MonthData = { month: string; expenses: Expense[] };
const NONE = "none";

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function ExpensesScreen({ today, first, types: initialTypes, canDelete }: { today: string; first: MonthData; types: ExpenseType[]; canDelete: boolean }) {
  const { t, money } = useI18n();
  const [data, setData] = useState(first);
  const [types, setTypes] = useState(initialTypes);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const load = async (month: string) => {
    try {
      setData(await getJson<MonthData>(`/api/expenses?month=${month}`));
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const total = data.expenses.reduce((s, e) => s + e.amountCents, 0);
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data.expenses) m.set(e.typeName || t.expenses.noType, (m.get(e.typeName || t.expenses.noType) ?? 0) + e.amountCents);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [data, t]);
  const [y, m] = data.month.split("-").map(Number);
  const monthLabel = `${t.monthsLong[m - 1]} ${y}`;

  return (
    <PageBody>
      <PageHeader title={t.expenses.title} description={t.expenses.intro}>
        <Button variant="outline" onClick={() => setManaging(true)}>
          <TagsIcon />
          {t.expenses.types}
        </Button>
        <Button onClick={() => setAdding(true)}>
          <PlusIcon />
          {t.expenses.add}
        </Button>
      </PageHeader>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t.expenses.previous} onClick={() => load(shiftMonth(data.month, -1))}>
          <ChevronLeftIcon className="rtl:-scale-x-100" />
        </Button>
        <p className="min-w-40 text-center font-semibold">{monthLabel}</p>
        <Button variant="outline" size="icon" aria-label={t.expenses.next} disabled={data.month >= today.slice(0, 7)} onClick={() => load(shiftMonth(data.month, 1))}>
          <ChevronRightIcon className="rtl:-scale-x-100" />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="h-fit">
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">{t.expenses.total}</p>
              <p className="tabular text-3xl font-extrabold">{money(total)}</p>
            </div>
            {byType.length > 0 && (
              <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
                {byType.map(([name, cents]) => (
                  <li key={name} className="flex justify-between gap-3">
                    <span className="truncate text-muted-foreground">{name}</span>
                    <span className="tabular font-semibold">{money(cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          {data.expenses.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <WalletIcon className="size-10 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">{t.expenses.none}</p>
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {data.expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="tabular w-10 shrink-0 text-center text-lg font-bold text-muted-foreground">{Number(e.day.slice(8))}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.typeName || t.expenses.noType}</p>
                    <p className="truncate text-xs text-muted-foreground">{[t.till.methods[e.method], e.note, e.staffName].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="tabular font-bold">{money(e.amountCents)}</span>
                  {canDelete && (
                    <Button variant="destructive-ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setDeleting(e)}>
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {adding && (
        <ExpenseDialog
          today={today}
          types={types}
          onClose={() => setAdding(false)}
          onSaved={(e) => {
            setAdding(false);
            toast.success(t.common.saved);
            if (e.day.startsWith(data.month)) setData((d) => ({ ...d, expenses: [e, ...d.expenses].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt) }));
          }}
        />
      )}
      <NameListDialog
        open={managing}
        onOpenChange={setManaging}
        endpoint="/api/expense-types"
        responseKey="type"
        items={types}
        onChange={setTypes}
        texts={{ title: t.expenses.types, intro: t.expenses.typesIntro, placeholder: t.expenses.newType, none: t.expenses.noTypes, deleteTitle: t.expenses.deleteTypeTitle, deleteText: t.expenses.deleteTypeText }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t.expenses.deleteTitle}
        description={deleting ? `${deleting.typeName || t.expenses.noType} · ${money(deleting.amountCents)}` : ""}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`/api/expenses/${deleting!.id}`, "DELETE");
          setData((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== deleting!.id) }));
          setDeleting(null);
        }}
      />
    </PageBody>
  );
}

function ExpenseDialog({ today, types, onClose, onSaved }: { today: string; types: ExpenseType[]; onClose: () => void; onSaved: (e: Expense) => void }) {
  const { t } = useI18n();
  const [clientId] = useState(newClientId);
  const [day, setDay] = useState(today);
  const [typeId, setTypeId] = useState<number | null>(types[0]?.id ?? null);
  const [amount, setAmount] = useState<number | null>(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!amount) return setError(t.expenses.amountNeeded);
    setBusy(true);
    setError(null);
    const body = { clientId, day, typeId, amountCents: amount, method, note: note.trim() };
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      const { expense } = await sendJson<{ expense: Expense }>("/api/expenses", "POST", body);
      onSaved(expense);
    } catch (err) {
      if (isNetworkError(err)) {
        // Kept on this device and sent when the connection is back.
        await enqueue("expense", "/api/expenses", body);
        toast.message(t.offline.savedOffline);
        onSaved({ id: -Date.now(), day, typeId, typeName: types.find((x) => x.id === typeId)?.name ?? "", amountCents: amount, method, note: note.trim(), staffName: "", createdAt: Date.now() });
        return;
      }
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.expenses.add}</DialogTitle>
          <DialogDescription className="sr-only">{t.expenses.intro}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-amount">{t.expenses.amount}</Label>
              <MoneyInput id="e-amount" cents={0} onChange={setAmount} className="h-11 text-lg" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-day">{t.expenses.day}</Label>
              <Input id="e-day" type="date" dir="ltr" value={day} max={today} onChange={(e) => setDay(e.target.value || today)} className="h-11" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-type">{t.expenses.type}</Label>
              <Select value={typeId === null ? NONE : String(typeId)} onValueChange={(v) => setTypeId(v === NONE ? null : Number(v))}>
                <SelectTrigger id="e-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t.expenses.noType}</SelectItem>
                  {types.map((ty) => (
                    <SelectItem key={ty.id} value={String(ty.id)}>
                      {ty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.expenses.paidBy}</Label>
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
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-note">{t.expenses.note}</Label>
            <Input id="e-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </div>
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
