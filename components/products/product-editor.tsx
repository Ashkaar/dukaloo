"use client";

import { ArrowLeftIcon, BarcodeIcon, PlusIcon, PrinterIcon, Trash2Icon, WandSparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  combinations,
  DECIMAL_UNITS,
  LIMITS,
  UNITS,
  variantLabel,
  type Category,
  type Product,
  type ProductInput,
  type ProductOption,
  type Unit,
} from "@/lib/catalog";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { MoneyInput, QuantityInput } from "../money-input";
import { PageBody } from "../page-header";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { LabelsDialog } from "./labels-dialog";
import { StockDialog } from "./stock-dialog";

interface Draft {
  // A stable key for React, also for variants not saved yet.
  key: string;
  id?: number;
  options: string[];
  sku: string;
  barcode: string;
  priceCents: number | null;
  costCents: number | null;
  lowStockMilli: number | null;
  active: boolean;
}

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;
const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v.toLocaleLowerCase() === b[i].toLocaleLowerCase());
const NONE = "none";

function blankDraft(options: string[] = [], like?: Draft): Draft {
  return {
    key: newKey(),
    options,
    sku: "",
    barcode: "",
    priceCents: like?.priceCents ?? 0,
    costCents: like?.costCents ?? 0,
    lowStockMilli: like?.lowStockMilli ?? 0,
    active: true,
  };
}

export function ProductEditor({ product, categories, stock = {} }: { product: Product | null; categories: Category[]; stock?: Record<number, number> }) {
  const { t, quantity } = useI18n();
  const shop = useShop();
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(product?.categoryId ?? null);
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [unit, setUnit] = useState<Unit>(product?.unit ?? "piece");
  const [active, setActive] = useState(product?.active ?? true);
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? true);
  const [options, setOptions] = useState<ProductOption[]>(product?.options ?? []);
  const [hasOptions, setHasOptions] = useState((product?.options.length ?? 0) > 0);
  const [variants, setVariants] = useState<Draft[]>(() =>
    product ? product.variants.map((v) => ({ ...v, key: `v${v.id}` })) : [blankDraft()],
  );
  const [samePrice, setSamePrice] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [labels, setLabels] = useState(false);
  const [levels, setLevels] = useState(stock);
  const [adjusting, setAdjusting] = useState<{ id: number; label: string } | null>(null);

  // Variants follow the options: one per combination, keeping what was
  // already entered for a combination that still exists.
  const applyOptions = (next: ProductOption[]) => {
    setOptions(next);
    const usable = next.filter((o) => o.name.trim() && o.values.length > 0);
    setVariants((current) => {
      if (usable.length === 0) return current.length > 0 ? [{ ...current[0], options: [] }] : [blankDraft()];
      return combinations(usable).map((combo) => current.find((d) => sameValues(d.options, combo)) ?? blankDraft(combo, current[0]));
    });
  };

  const toggleOptions = (on: boolean) => {
    setHasOptions(on);
    applyOptions(on ? [{ name: "", values: [] }] : []);
  };

  const updateVariant = (key: string, change: Partial<Draft>) => setVariants((list) => list.map((d) => (d.key === key ? { ...d, ...change } : d)));

  const makeBarcode = async (key: string) => {
    try {
      const { barcode } = await sendJson<{ barcode: string }>("/api/barcodes", "POST");
      updateVariant(key, { barcode });
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const usable = hasOptions ? options.filter((o) => o.name.trim() && o.values.length > 0) : [];
    if (variants.some((v) => v.priceCents === null || v.costCents === null || v.lowStockMilli === null)) {
      setError(t.errors.invalid);
      return;
    }
    const body: ProductInput = {
      name: name.trim(),
      categoryId,
      brand: brand.trim(),
      description: description.trim(),
      unit,
      active,
      trackStock,
      options: usable.map((o) => ({ name: o.name.trim(), values: o.values })),
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        options: usable.length > 0 ? v.options : [],
        sku: v.sku.trim(),
        barcode: v.barcode.trim(),
        priceCents: v.priceCents!,
        costCents: v.costCents!,
        lowStockMilli: v.lowStockMilli!,
        active: v.active,
      })),
    };
    setBusy(true);
    setError(null);
    try {
      const { product: saved } = await sendJson<{ product: Product }>(product ? `/api/products/${product.id}` : "/api/products", product ? "PUT" : "POST", body);
      toast.success(t.products.saved);
      if (!product) {
        router.replace(shop.href(`/dashboard/products/${saved.id}`));
      } else {
        setVariants(saved.variants.map((v) => ({ ...v, key: `v${v.id}` })));
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!product) return;
    await sendJson(`/api/products/${product.id}`, "DELETE");
    toast.success(t.products.archived);
    router.push(shop.href("/dashboard/products"));
  };

  const single = variants.length === 1 && !hasOptions ? variants[0] : null;
  const decimalUnit = DECIMAL_UNITS.includes(unit);

  return (
    <PageBody>
      <form onSubmit={save} className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label={t.products.back}>
              <Link href={shop.href("/dashboard/products")}>
                <ArrowLeftIcon className="rtl:-scale-x-100" />
              </Link>
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">{product ? product.name : t.products.newTitle}</h1>
          </div>
          <div className="flex gap-2">
            {product && (
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setLabels(true)}>
                <PrinterIcon />
                {t.products.labels}
              </Button>
            )}
            <Button type="submit" className="flex-1 sm:flex-none" disabled={busy || !name.trim()}>
              {busy ? t.common.saving : t.products.save}
            </Button>
          </div>
        </div>

        <FormError message={error} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.products.details}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="p-name">{t.products.name}</Label>
                  <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} required autoFocus={!product} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-brand">
                      {t.products.brand} <span className="font-normal text-muted-foreground">({t.common.optional})</span>
                    </Label>
                    <Input id="p-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={LIMITS.brand} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-unit">{t.products.unit}</Label>
                    <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                      <SelectTrigger id="p-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {t.units[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {decimalUnit && <p className="text-xs text-muted-foreground">{t.products.unitNote}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-description">
                    {t.products.description} <span className="font-normal text-muted-foreground">({t.common.optional})</span>
                  </Label>
                  <Textarea id="p-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={LIMITS.description} rows={3} />
                </div>
              </CardContent>
            </Card>

            {single ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t.products.pricing}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t.products.price} htmlFor="p-price">
                      <MoneyInput id="p-price" cents={single.priceCents ?? 0} onChange={(c) => updateVariant(single.key, { priceCents: c })} />
                    </Field>
                    <Field label={t.products.cost} htmlFor="p-cost" note={t.products.costNote}>
                      <MoneyInput id="p-cost" cents={single.costCents ?? 0} onChange={(c) => updateVariant(single.key, { costCents: c })} />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t.products.barcode} htmlFor="p-barcode" note={t.products.barcodeNote}>
                      <BarcodeField id="p-barcode" value={single.barcode} onChange={(v) => updateVariant(single.key, { barcode: v })} onMake={() => makeBarcode(single.key)} />
                    </Field>
                    <Field label={t.products.sku} htmlFor="p-sku" note={t.products.skuNote}>
                      <Input id="p-sku" dir="ltr" value={single.sku} onChange={(e) => updateVariant(single.key, { sku: e.target.value })} maxLength={LIMITS.sku} />
                    </Field>
                  </div>
                  <Field label={t.products.lowStock} htmlFor="p-low" note={t.products.lowStockNote}>
                    <QuantityInput id="p-low" milli={single.lowStockMilli ?? 0} onChange={(m) => updateVariant(single.key, { lowStockMilli: m })} className="sm:w-48" />
                  </Field>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <Label className="flex w-full cursor-pointer items-center justify-between gap-4 text-base font-semibold">
                  {t.products.hasOptions}
                  <Switch checked={hasOptions} onCheckedChange={toggleOptions} />
                </Label>
              </CardHeader>
              {hasOptions && (
                <CardContent className="space-y-4">
                  {options.map((o, i) => (
                    <OptionEditor
                      key={i}
                      option={o}
                      onChange={(next) => applyOptions(options.map((x, j) => (j === i ? next : x)))}
                      onRemove={() => {
                        const rest = options.filter((_, j) => j !== i);
                        if (rest.length === 0) toggleOptions(false);
                        else applyOptions(rest);
                      }}
                    />
                  ))}
                  {options.length < LIMITS.options && (
                    <Button type="button" variant="soft" size="sm" onClick={() => applyOptions([...options, { name: "", values: [] }])}>
                      <PlusIcon />
                      {t.products.addOption}
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>

          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4">
                <Label className="flex cursor-pointer items-center justify-between gap-4">
                  <span>
                    <span className="block font-semibold">{t.products.active}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{t.products.activeNote}</span>
                  </span>
                  <Switch checked={active} onCheckedChange={setActive} />
                </Label>
                <Label className="flex cursor-pointer items-center justify-between gap-4">
                  <span>
                    <span className="block font-semibold">{t.stock.trackStock}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{t.stock.trackStockNote}</span>
                  </span>
                  <Switch checked={trackStock} onCheckedChange={setTrackStock} />
                </Label>
                <div className="space-y-2">
                  <Label htmlFor="p-category">{t.products.category}</Label>
                  <Select value={categoryId === null ? NONE : String(categoryId)} onValueChange={(v) => setCategoryId(v === NONE ? null : Number(v))}>
                    <SelectTrigger id="p-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t.products.noCategory}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            {product && product.trackStock && (
              <Card>
                <CardHeader>
                  <CardTitle>{t.stock.inStock}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                  <ul className="divide-y divide-border">
                    {product.variants.map((v) => {
                      const label = variantLabel(v) || product.name;
                      const level = levels[v.id] ?? 0;
                      return (
                        <li key={v.id} className="flex items-center gap-3 px-5 py-2.5">
                          <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                          <span className={cn("tabular text-sm font-bold", level <= 0 ? "text-red-600 dark:text-red-400" : level <= v.lowStockMilli ? "text-accent-700 dark:text-accent-400" : "")}>
                            {quantity(level)}
                          </span>
                          <Button type="button" variant="outline" size="sm" onClick={() => setAdjusting({ id: v.id, label })}>
                            {t.stock.adjust}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
            {product && (
              <Button type="button" variant="destructive-ghost" className="w-full" onClick={() => setArchiving(true)}>
                <Trash2Icon />
                {t.products.archive}
              </Button>
            )}
          </div>
        </div>

          {hasOptions && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{t.products.variantsTitle}</CardTitle>
                  <CardDescription className="mt-1">{t.products.variantsIntro}</CardDescription>
                </div>
                {variants.length > 1 && (
                  <div className="flex items-end gap-2">
                    <div className="w-36">
                      <MoneyInput cents={samePrice ?? 0} onChange={setSamePrice} aria-label={t.products.samePrice} className="h-9" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={samePrice === null}
                      onClick={() => setVariants((list) => list.map((d) => ({ ...d, priceCents: samePrice })))}
                    >
                      {t.products.samePrice}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {variants.every((v) => v.options.length === 0) ? (
                  <p className="px-5 pb-4 text-sm text-muted-foreground">{t.products.noVariants}</p>
                ) : (
                  <div className="divide-y divide-border">
                    <div className="hidden grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(12rem,1.6fr)_minmax(7rem,1fr)_auto] gap-3 px-5 pt-2 pb-2 text-xs font-semibold text-muted-foreground xl:grid">
                      <span>{t.products.variant}</span>
                      <span>
                        {t.products.price} ({shop.currency})
                      </span>
                      <span>
                        {t.products.cost} ({shop.currency})
                      </span>
                      <span>{t.products.barcode}</span>
                      <span>{t.products.sku}</span>
                      <span className="sr-only">{t.products.active}</span>
                    </div>
                    {variants.map((v) => (
                      <div key={v.key} className={cn("grid grid-cols-2 gap-3 px-5 py-3 xl:grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(12rem,1.6fr)_minmax(7rem,1fr)_auto] xl:items-center", !v.active && "opacity-60")}>
                        <p className="col-span-2 self-center font-semibold xl:col-span-1">{variantLabel(v)}</p>
                        <Field label={`${t.products.price} (${shop.currency})`} compact>
                          <MoneyInput showCurrency={false} cents={v.priceCents ?? 0} onChange={(c) => updateVariant(v.key, { priceCents: c })} aria-label={`${t.products.price} ${variantLabel(v)}`} />
                        </Field>
                        <Field label={`${t.products.cost} (${shop.currency})`} compact>
                          <MoneyInput showCurrency={false} cents={v.costCents ?? 0} onChange={(c) => updateVariant(v.key, { costCents: c })} aria-label={`${t.products.cost} ${variantLabel(v)}`} />
                        </Field>
                        <Field label={t.products.barcode} compact className="col-span-2 xl:col-span-1">
                          <BarcodeField value={v.barcode} onChange={(b) => updateVariant(v.key, { barcode: b })} onMake={() => makeBarcode(v.key)} aria-label={`${t.products.barcode} ${variantLabel(v)}`} />
                        </Field>
                        <Field label={t.products.sku} compact>
                          <Input dir="ltr" value={v.sku} onChange={(e) => updateVariant(v.key, { sku: e.target.value })} maxLength={LIMITS.sku} aria-label={`${t.products.sku} ${variantLabel(v)}`} />
                        </Field>
                        <Label className="flex items-center justify-end gap-2 text-xs xl:justify-center">
                          <span className="xl:sr-only">{t.products.active}</span>
                          <Switch checked={v.active} onCheckedChange={(on) => updateVariant(v.key, { active: on })} aria-label={`${t.products.active} ${variantLabel(v)}`} />
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
      </form>

      {product && (
        <>
          <ConfirmDialog
            open={archiving}
            onOpenChange={setArchiving}
            title={t.products.archiveTitle(product.name)}
            description={t.products.archiveText}
            confirmLabel={t.common.delete}
            destructive
            onConfirm={archive}
          />
          <LabelsDialog open={labels} onOpenChange={setLabels} product={product} />
          {adjusting && (
            <StockDialog
              variantId={adjusting.id}
              label={adjusting.label}
              level={levels[adjusting.id] ?? 0}
              onClose={() => setAdjusting(null)}
              onSaved={(milli) => {
                setLevels((l) => ({ ...l, [adjusting.id]: milli }));
                setAdjusting(null);
              }}
            />
          )}
        </>
      )}
    </PageBody>
  );
}

function Field({
  label,
  htmlFor,
  note,
  compact = false,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  note?: string;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1 xl:space-y-0", className)}>
      <Label htmlFor={htmlFor} className={cn(compact && "text-xs text-muted-foreground xl:sr-only")}>
        {label}
      </Label>
      {children}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

// A barcode: typed, scanned into (the scanner types into the focused
// field), or made by the shop.
function BarcodeField({
  value,
  onChange,
  onMake,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & { value: string; onChange: (v: string) => void; onMake: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1">
      <div className="relative flex-1">
        <BarcodeIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ""))}
          // A scanner ends with Enter: keep it from submitting the form.
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          maxLength={LIMITS.barcode}
          className="ps-8 font-mono text-sm"
          {...props}
        />
      </div>
      {!value && (
        <Button type="button" variant="outline" size="icon" onClick={onMake} aria-label={t.products.generate} title={t.products.generate}>
          <WandSparklesIcon />
        </Button>
      )}
    </div>
  );
}

// One option (Size) and its values (S, M, L), typed as chips.
function OptionEditor({ option, onChange, onRemove }: { option: ProductOption; onChange: (o: ProductOption) => void; onRemove: () => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const addValue = () => {
    const v = draft.trim().replace(/,$/, "").trim();
    if (!v) return;
    if (!option.values.some((x) => x.toLocaleLowerCase() === v.toLocaleLowerCase()) && option.values.length < LIMITS.valuesPerOption) {
      onChange({ ...option, values: [...option.values, v.slice(0, LIMITS.optionValue)] });
    }
    setDraft("");
  };
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label>{t.products.optionName}</Label>
          <Input value={option.name} onChange={(e) => onChange({ ...option, name: e.target.value })} placeholder={t.products.optionNamePlaceholder} maxLength={LIMITS.optionName} />
        </div>
        <Button type="button" variant="destructive-ghost" size="icon" onClick={onRemove} aria-label={t.products.removeOption}>
          <Trash2Icon />
        </Button>
      </div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        {option.values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-primary-soft py-0.5 ps-2 pe-1 text-sm font-medium text-primary-soft-foreground">
            {v}
            <button
              type="button"
              className="cursor-pointer rounded p-0.5 hover:bg-primary/15"
              aria-label={t.products.removeValue(v)}
              onClick={() => onChange({ ...option, values: option.values.filter((x) => x !== v) })}
            >
              <XIcon className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? (setDraft(e.target.value), addValue()) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addValue();
            } else if (e.key === "Backspace" && !draft && option.values.length > 0) {
              onChange({ ...option, values: option.values.slice(0, -1) });
            }
          }}
          onBlur={addValue}
          placeholder={option.values.length === 0 ? t.products.valuesPlaceholder : ""}
          aria-label={t.products.valuesPlaceholder}
          maxLength={LIMITS.optionValue}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
