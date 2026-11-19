"use client";

import { ArrowLeftIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { MILLI } from "@/lib/format";
import { lineCost, type BuyableItem, type Purchase, type Supplier } from "@/lib/purchases";
import { CameraScannerButton } from "../camera-scanner";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { MoneyInput, QuantityInput } from "../money-input";
import { PageBody } from "../page-header";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { useScanner } from "../use-scanner";

interface Line {
  key: number;
  item: BuyableItem;
  qtyMilli: number | null;
  unitCostCents: number | null;
}

let nextKey = 0;
const NONE = "none";

function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

// Receiving stock: what came in, how many, and what each cost.
export function PurchaseForm({ items, suppliers }: { items: BuyableItem[]; suppliers: Supplier[] }) {
  const { t, money } = useI18n();
  const shop = useShop();
  const router = useRouter();
  const [clientId] = useState(newClientId);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [updateCosts, setUpdateCosts] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byCode = useMemo(() => {
    const m = new Map<string, BuyableItem>();
    for (const i of items) if (i.sku) m.set(i.sku.toLowerCase(), i);
    for (const i of items) if (i.barcode) m.set(i.barcode.toLowerCase(), i);
    return m;
  }, [items]);
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return items.filter((i) => i.name.toLowerCase().includes(n) || i.variantLabel.toLowerCase().includes(n) || i.barcode === n || i.sku.toLowerCase() === n).slice(0, 8);
  }, [items, q]);

  const add = (item: BuyableItem) => {
    setLines((list) => {
      const i = list.findIndex((l) => l.item.variantId === item.variantId);
      if (i >= 0) return list.map((l, j) => (j === i ? { ...l, qtyMilli: (l.qtyMilli ?? 0) + MILLI } : l));
      return [...list, { key: ++nextKey, item, qtyMilli: MILLI, unitCostCents: item.costCents }];
    });
    setQ("");
  };
  const addByCode = (code: string) => {
    const item = byCode.get(code.trim().toLowerCase());
    if (item) add(item);
    else toast.error(t.till.notFound(code));
  };
  useScanner(addByCode);

  const update = (key: number, change: Partial<Line>) => setLines((list) => list.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const valid = lines.length > 0 && lines.every((l) => l.qtyMilli !== null && l.qtyMilli > 0 && l.unitCostCents !== null);
  const total = lines.reduce((s, l) => s + lineCost(l.qtyMilli ?? 0, l.unitCostCents ?? 0), 0);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { purchase } = await sendJson<{ purchase: Purchase }>("/api/purchases", "POST", {
        clientId,
        supplierId,
        reference: reference.trim(),
        note: note.trim(),
        updateCosts,
        lines: lines.map((l) => ({ variantId: l.item.variantId, qtyMilli: l.qtyMilli, unitCostCents: l.unitCostCents })),
      });
      toast.success(t.purchases.saved);
      router.push(shop.href(`/dashboard/purchases/${purchase.id}`));
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t.purchases.back}>
          <Link href={shop.href("/dashboard/purchases")}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">{t.purchases.newTitle}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.purchases.itemsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && q.trim()) {
                        e.preventDefault();
                        if (byCode.has(q.trim().toLowerCase())) addByCode(q);
                        else if (matches.length === 1) add(matches[0]);
                      }
                    }}
                    placeholder={t.till.search}
                    aria-label={t.till.search}
                    className="ps-9"
                  />
                  {matches.length > 0 && (
                    <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                      {matches.map((m) => (
                        <li key={m.variantId}>
                          <button type="button" onClick={() => add(m)} className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-highlight">
                            <span className="truncate">{[m.name, m.variantLabel].filter(Boolean).join(" · ")}</span>
                            <span className="tabular text-xs text-muted-foreground">{money(m.costCents)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <CameraScannerButton continuous onScan={addByCode} />
              </div>
              {lines.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t.purchases.noLines}</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {lines.map((l) => {
                    const name = [l.item.name, l.item.variantLabel].filter(Boolean).join(" · ");
                    return (
                      <li key={l.key} className="grid grid-cols-2 items-end gap-3 p-3 sm:grid-cols-[1fr_7rem_9rem_7rem_auto]">
                        <p className="col-span-2 self-center font-medium sm:col-span-1">{name}</p>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.purchases.qty}</Label>
                          <QuantityInput milli={l.qtyMilli ?? 0} onChange={(m) => update(l.key, { qtyMilli: m })} aria-label={`${t.purchases.qty} ${name}`} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t.purchases.unitCost}</Label>
                          <MoneyInput cents={l.unitCostCents ?? 0} onChange={(c) => update(l.key, { unitCostCents: c })} aria-label={`${t.purchases.unitCost} ${name}`} />
                        </div>
                        <p className="tabular self-center text-end font-semibold">{money(lineCost(l.qtyMilli ?? 0, l.unitCostCents ?? 0))}</p>
                        <Button variant="ghost" size="icon" aria-label={`${t.till.remove} ${name}`} onClick={() => setLines((list) => list.filter((x) => x.key !== l.key))}>
                          <Trash2Icon />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-supplier">{t.purchases.supplier}</Label>
                <Select value={supplierId === null ? NONE : String(supplierId)} onValueChange={(v) => setSupplierId(v === NONE ? null : Number(v))}>
                  <SelectTrigger id="p-supplier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t.purchases.noSupplier}</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-ref">{t.purchases.reference}</Label>
                <Input id="p-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} placeholder={t.purchases.referenceHint} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-note">{t.purchases.note}</Label>
                <Input id="p-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
              </div>
              <Label className="flex cursor-pointer items-start justify-between gap-3">
                <span>
                  <span className="block font-medium">{t.purchases.updateCosts}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{t.purchases.updateCostsNote}</span>
                </span>
                <Switch checked={updateCosts} onCheckedChange={setUpdateCosts} />
              </Label>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="font-bold">{t.till.total}</span>
                <span className="tabular text-2xl font-extrabold">{money(total)}</span>
              </div>
              <FormError message={error} />
              <Button size="lg" className="w-full" disabled={!valid || busy} onClick={save}>
                {busy ? t.common.saving : t.purchases.receive}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
