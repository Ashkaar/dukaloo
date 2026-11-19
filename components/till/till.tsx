"use client";

import { BadgePercentIcon, MinusIcon, PackageIcon, PlusIcon, ScanBarcodeIcon, SearchIcon, ShoppingCartIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DECIMAL_UNITS, type Category, type Unit } from "@/lib/catalog";
import { ApiError, errorMessage, getJson } from "@/lib/clientApi";
import { MILLI } from "@/lib/format";
import { computeTotals, type Sale, type SaleDiscount, type SalesSettings, type TillItem } from "@/lib/sale";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n-provider";
import { MoneyInput, QuantityInput } from "../money-input";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import { useScanner } from "../use-scanner";
import { PayDialog } from "./pay-dialog";
import { ReceiptDialog } from "./receipt-dialog";

export interface CartLine {
  variantId: number;
  qtyMilli: number;
  discountCents: number;
}

const ALL = 0;

export function Till({ initialItems, initialSettings, categories }: { initialItems: TillItem[]; initialSettings: SalesSettings; categories: Category[] }) {
  const { t, money, quantity } = useI18n();
  const { decimals } = useShop();
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState<SaleDiscount | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<number>(ALL);
  const [editing, setEditing] = useState<number | null>(null);
  const [discounting, setDiscounting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [done, setDone] = useState<Sale | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const byCode = useMemo(() => {
    const m = new Map<string, TillItem>();
    for (const i of items) {
      if (i.sku) m.set(i.sku.toLowerCase(), i);
    }
    for (const i of items) if (i.barcode) m.set(i.barcode.toLowerCase(), i);
    return m;
  }, [items]);

  const reload = useCallback(async () => {
    try {
      const data = await getJson<{ items: TillItem[]; settings: SalesSettings }>("/api/till/items");
      setItems(data.items);
      setSettings(data.settings);
    } catch {
      // Keep what we have; the next sale will say if something changed.
    }
  }, []);

  // Fresh prices and stock when the tab comes back into view.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const inCart = (id: number) => cart.filter((l) => l.variantId === id).reduce((s, l) => s + l.qtyMilli, 0);

  const add = (item: TillItem, qtyMilli = MILLI) => {
    const after = item.stockMilli - inCart(item.variantId) - qtyMilli;
    const label = item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name;
    if (item.trackStock && after < 0) {
      if (!settings.allowNegativeStock) {
        toast.error(t.till.outOfStock(label));
        return;
      }
      toast.warning(t.till.noStockLeft(label));
    }
    setCart((list) => {
      const i = list.findIndex((l) => l.variantId === item.variantId && l.discountCents === 0);
      if (i >= 0) return list.map((l, j) => (j === i ? { ...l, qtyMilli: l.qtyMilli + qtyMilli } : l));
      return [...list, { variantId: item.variantId, qtyMilli, discountCents: 0 }];
    });
  };

  const addByCode = (code: string): boolean => {
    const item = byCode.get(code.trim().toLowerCase());
    if (!item) return false;
    add(item);
    return true;
  };

  useScanner((code) => {
    if (!addByCode(code)) toast.error(t.till.notFound(code));
  }, !paying && !done && editing === null && !discounting);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => category === ALL || i.categoryId === category)
      .filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.variantLabel.toLowerCase().includes(needle) || i.barcode === needle || i.sku.toLowerCase().includes(needle))
      .slice(0, 120);
  }, [items, q, category]);

  const priced = cart.map((l) => ({ line: l, item: byId.get(l.variantId) }));
  const totals = computeTotals(
    priced.map(({ line, item }) => ({ unitPriceCents: item?.priceCents ?? 0, qtyMilli: line.qtyMilli, discountCents: line.discountCents })),
    discount,
    settings.tax,
    decimals,
  );
  const count = cart.reduce((s, l) => s + (DECIMAL_UNITS.includes((byId.get(l.variantId)?.unit ?? "piece") as Unit) ? 1 : l.qtyMilli / MILLI), 0);
  const rate = `${settings.tax.rateBp / 100}%`;

  const clear = () => {
    setCart([]);
    setDiscount(null);
  };

  const finished = (sale: Sale) => {
    // Take the sold items off the till's own stock figures.
    setItems((list) =>
      list.map((i) => {
        const sold = sale.lines.filter((l) => l.variantId === i.variantId).reduce((s, l) => s + l.qtyMilli, 0);
        return sold && i.trackStock ? { ...i, stockMilli: i.stockMilli - sold } : i;
      }),
    );
    clear();
    setPaying(false);
    setCartOpen(false);
    setDone(sale);
  };

  const failed = (err: unknown) => {
    toast.error(errorMessage(err, t.common.somethingWrong));
    if (err instanceof ApiError && (err.status === 409 || err.status === 400)) reload();
  };

  const cartPanel = (inSheet: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex items-center justify-between gap-2 border-b border-border px-4 py-3", inSheet && "pe-12")}>
        <h2 className="flex items-center gap-2 font-bold">
          <ShoppingCartIcon className="size-4" />
          {t.till.cart}
          {cart.length > 0 && <Badge variant="neutral">{t.till.items(Math.round(count))}</Badge>}
        </h2>
        {cart.length > 0 && (
          <Button variant="destructive-ghost" size="sm" onClick={clear}>
            <XIcon />
            {t.till.clear}
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
            <ScanBarcodeIcon className="size-10 opacity-40" />
            {t.till.empty}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {priced.map(({ line, item }, i) => {
              const decimal = DECIMAL_UNITS.includes((item?.unit ?? "piece") as Unit);
              return (
                <li key={`${line.variantId}-${i}`} className="flex items-center gap-2 px-4 py-2.5">
                  <button type="button" className="min-w-0 flex-1 cursor-pointer text-start" onClick={() => setEditing(i)}>
                    <p className="truncate text-sm font-semibold">{item?.name ?? "?"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[item?.variantLabel, `${quantity(line.qtyMilli)} × ${money(item?.priceCents ?? 0)}`].filter(Boolean).join(" · ")}
                      {line.discountCents > 0 && <span className="text-accent-700 dark:text-accent-400"> · -{money(totals.lines[i].discountCents)}</span>}
                    </p>
                  </button>
                  {!decimal && (
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${t.till.less} ${item?.name ?? ""}`}
                        onClick={() =>
                          setCart((list) => (line.qtyMilli <= MILLI ? list.filter((_, j) => j !== i) : list.map((l, j) => (j === i ? { ...l, qtyMilli: l.qtyMilli - MILLI } : l))))
                        }
                      >
                        <MinusIcon />
                      </Button>
                      <span className="tabular w-7 text-center text-sm font-semibold">{quantity(line.qtyMilli)}</span>
                      <Button variant="ghost" size="icon-sm" aria-label={`${t.till.more} ${item?.name ?? ""}`} onClick={() => item && add(item)}>
                        <PlusIcon />
                      </Button>
                    </div>
                  )}
                  <span className="tabular w-24 text-end text-sm font-bold">{money(totals.lines[i].netCents)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
        <Row label={t.till.subtotal} value={money(totals.subtotalCents)} />
        {totals.discountCents > 0 && <Row label={t.till.discount} value={`-${money(totals.discountCents)}`} accent />}
        {settings.tax.enabled && totals.taxCents > 0 && !settings.tax.inclusive && <Row label={`${settings.tax.name} ${rate}`} value={money(totals.taxCents)} />}
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-base font-bold">{t.till.total}</span>
          <span className="tabular text-2xl font-extrabold">{money(totals.totalCents)}</span>
        </div>
        {settings.tax.enabled && totals.taxCents > 0 && settings.tax.inclusive && (
          <p className="text-end text-xs text-muted-foreground">{t.receipt.taxIncluded(settings.tax.name, rate)}: {money(totals.taxCents)}</p>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="touch" className="px-4" disabled={cart.length === 0} onClick={() => setDiscounting(true)} aria-label={t.till.saleDiscount}>
            <BadgePercentIcon className="size-5" />
          </Button>
          <Button size="touch" className="flex-1" disabled={cart.length === 0} onClick={() => setPaying(true)}>
            {t.till.pay} · {money(totals.totalCents)}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    // Fills the screen below the header and above the phone's bottom bar
    // (cancelling the page padding the app frame adds for it).
    <div className="-mb-24 flex h-[calc(100dvh-3.5rem-4rem)] min-h-0 md:-mb-10 md:h-[calc(100dvh-3rem)]">
      <section className="flex min-w-0 flex-1 flex-col gap-3 px-4 pt-2 pb-24 md:px-6 lg:pb-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // A scanner typing into the search box ends with Enter.
              if (e.key === "Enter" && q.trim()) {
                e.preventDefault();
                if (addByCode(q)) setQ("");
                else if (visible.length === 1) {
                  add(visible[0]);
                  setQ("");
                } else if (visible.length === 0) toast.error(t.till.notFound(q.trim()));
              }
            }}
            placeholder={t.till.search}
            aria-label={t.till.search}
            className="h-12 ps-9 text-base"
            maxLength={100}
          />
        </div>
        {categories.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {[{ id: ALL, name: t.till.all }, ...categories].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "h-9 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                  category === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-highlight",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <PackageIcon className="size-10 opacity-40" />
              {t.till.noItems}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t.till.noMatch}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((i) => {
                const left = i.stockMilli - inCart(i.variantId);
                return (
                  <button
                    key={i.variantId}
                    type="button"
                    onClick={() => add(i)}
                    className="flex min-h-24 cursor-pointer flex-col justify-between gap-2 rounded-xl border border-border bg-card p-3 text-start shadow-xs transition-colors hover:border-primary/50 active:bg-primary-soft"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug">{i.name}</span>
                      {i.variantLabel && <span className="block truncate text-xs text-muted-foreground">{i.variantLabel}</span>}
                    </span>
                    <span className="flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5">
                      <span className="tabular text-sm font-bold whitespace-nowrap">{money(i.priceCents)}</span>
                      {i.trackStock && (
                        <span className={cn("tabular text-[11px] whitespace-nowrap", left <= 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                          {left <= 0 ? t.till.noStock : quantity(left)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Tablets and computers: the cart beside the products. */}
      <aside aria-label={t.till.cart} className="hidden w-[380px] shrink-0 border-s border-border bg-card lg:block xl:w-[420px]">
        {cartPanel(false)}
      </aside>

      {/* Phones and small tablets: a bar that opens the cart. */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card p-3 md:bottom-0 md:start-60 lg:hidden">
        <Button size="touch" className="w-full justify-between" onClick={() => setCartOpen(true)}>
          <span className="flex items-center gap-2">
            <ShoppingCartIcon className="size-5" />
            {t.till.cart}
            {cart.length > 0 && <span className="rounded-full bg-primary-foreground/20 px-2 text-sm">{Math.round(count)}</span>}
          </span>
          <span className="tabular">{money(totals.totalCents)}</span>
        </Button>
      </div>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" closeLabel={t.common.close} className="h-[85dvh] gap-0 p-0">
          <SheetTitle className="sr-only">{t.till.cart}</SheetTitle>
          {cartPanel(true)}
        </SheetContent>
      </Sheet>

      {editing !== null && cart[editing] && (
        <LineDialog
          line={cart[editing]}
          item={byId.get(cart[editing].variantId)}
          onClose={() => setEditing(null)}
          onSave={(line) => {
            setCart((list) => list.map((l, j) => (j === editing ? line : l)));
            setEditing(null);
          }}
          onRemove={() => {
            setCart((list) => list.filter((_, j) => j !== editing));
            setEditing(null);
          }}
        />
      )}
      {discounting && (
        <DiscountDialog
          value={discount}
          onClose={() => setDiscounting(false)}
          onSave={(d) => {
            setDiscount(d);
            setDiscounting(false);
          }}
        />
      )}
      {paying && <PayDialog cart={cart} discount={discount} totalCents={totals.totalCents} onClose={() => setPaying(false)} onDone={finished} onError={failed} />}
      {done && <ReceiptDialog sale={done} settings={settings} onClose={() => setDone(null)} />}
    </div>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between", accent ? "text-accent-700 dark:text-accent-400" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function LineDialog({
  line,
  item,
  onClose,
  onSave,
  onRemove,
}: {
  line: CartLine;
  item: TillItem | undefined;
  onClose: () => void;
  onSave: (line: CartLine) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [qty, setQty] = useState<number | null>(line.qtyMilli);
  const [disc, setDisc] = useState<number | null>(line.discountCents);
  const valid = qty !== null && qty > 0 && disc !== null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{item?.name}</DialogTitle>
          <DialogDescription>{item?.variantLabel || t.till.editLine}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="line-qty">{t.till.qty}</Label>
            <QuantityInput id="line-qty" milli={line.qtyMilli} onChange={setQty} className="h-12 text-lg" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line-discount">{t.till.lineDiscount}</Label>
            <MoneyInput id="line-discount" cents={line.discountCents} onChange={setDisc} className="h-12 text-lg" />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="destructive-ghost" onClick={onRemove}>
            <Trash2Icon />
            {t.till.remove}
          </Button>
          <Button disabled={!valid} onClick={() => valid && onSave({ ...line, qtyMilli: qty!, discountCents: disc! })}>
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscountDialog({ value, onClose, onSave }: { value: SaleDiscount | null; onClose: () => void; onSave: (d: SaleDiscount | null) => void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<"amount" | "percent">(value?.kind ?? "percent");
  const [cents, setCents] = useState<number | null>(value?.kind === "amount" ? value.cents : 0);
  const [percent, setPercent] = useState(value?.kind === "percent" ? String(value.bp / 100) : "");
  const bp = Math.round(Number(percent.replace(",", ".")) * 100);
  const percentOk = percent === "" || (Number.isFinite(bp) && bp >= 0 && bp <= 10_000);
  const save = () => {
    if (kind === "amount") onSave(cents ? { kind: "amount", cents } : null);
    else onSave(bp > 0 ? { kind: "percent", bp } : null);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.till.saleDiscount}</DialogTitle>
          <DialogDescription className="sr-only">{t.till.saleDiscount}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(["percent", "amount"] as const).map((k) => (
            <Button key={k} variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
              {k === "percent" ? t.till.percent : t.till.amount}
            </Button>
          ))}
        </div>
        {kind === "amount" ? (
          <MoneyInput cents={cents ?? 0} onChange={setCents} aria-label={t.till.amount} className="h-12 text-lg" autoFocus />
        ) : (
          <div className="relative">
            <Input
              inputMode="decimal"
              dir="ltr"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              aria-label={t.till.percent}
              aria-invalid={!percentOk || undefined}
              className="h-12 pe-10 text-end text-lg"
              autoFocus
            />
            <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted-foreground">%</span>
          </div>
        )}
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => onSave(null)}>
            {t.till.noDiscount}
          </Button>
          <Button onClick={save} disabled={kind === "amount" ? cents === null : !percentOk}>
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
