"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import type { SalesSettings } from "@/lib/sale";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

// Selling rules: stock, tax and the receipt. Owner only; others see them.
export function SellingCard({ initial, canChange }: { initial: SalesSettings; canChange: boolean }) {
  const { t } = useI18n();
  const [s, setS] = useState(initial);
  const [rate, setRate] = useState(String(initial.tax.rateBp / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rateBp = Math.round(Number(rate.replace(",", ".")) * 100);
  const rateOk = rate.trim() !== "" && Number.isFinite(rateBp) && rateBp >= 0 && rateBp <= 10_000;
  const off = !canChange || busy;

  const save = async () => {
    if (!rateOk) return setError(t.errors.invalid);
    setBusy(true);
    setError(null);
    try {
      const { settings } = await sendJson<{ settings: SalesSettings }>("/api/settings/sales", "PUT", { ...s, tax: { ...s.tax, rateBp } });
      setS(settings);
      toast.success(t.common.saved);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (label: string, note: string, checked: boolean, onChange: (v: boolean) => void) => (
    <Label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        {note && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{note}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={off} />
    </Label>
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t.selling.title}</CardTitle>
          {!canChange && <CardDescription className="mt-1">{t.selling.ownerOnly}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {toggle(t.selling.allowNegative, t.selling.allowNegativeNote, s.allowNegativeStock, (v) => setS({ ...s, allowNegativeStock: v }))}

        <div className="space-y-4 border-t border-border pt-5">
          {toggle(t.selling.taxEnabled, "", s.tax.enabled, (v) => setS({ ...s, tax: { ...s.tax, enabled: v } }))}
          {s.tax.enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tax-name">{t.selling.taxName}</Label>
                  <Input id="tax-name" value={s.tax.name} onChange={(e) => setS({ ...s, tax: { ...s.tax, name: e.target.value } })} maxLength={20} disabled={off} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">{t.selling.taxRate}</Label>
                  <Input id="tax-rate" inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} aria-invalid={!rateOk || undefined} disabled={off} className="text-end" />
                </div>
              </div>
              {toggle(t.selling.taxInclusive, t.selling.taxInclusiveNote, s.tax.inclusive, (v) => setS({ ...s, tax: { ...s.tax, inclusive: v } }))}
            </>
          )}
        </div>

        <div className="space-y-4 border-t border-border pt-5">
          <p className="font-medium">{t.selling.receipt}</p>
          <div className="space-y-2">
            <Label htmlFor="r-header">{t.selling.header}</Label>
            <Textarea id="r-header" dir="auto" rows={3} value={s.receipt.header} onChange={(e) => setS({ ...s, receipt: { ...s.receipt, header: e.target.value } })} maxLength={300} placeholder={t.selling.headerNote} disabled={off} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-footer">{t.selling.footer}</Label>
            <Textarea id="r-footer" dir="auto" rows={2} value={s.receipt.footer} onChange={(e) => setS({ ...s, receipt: { ...s.receipt, footer: e.target.value } })} maxLength={300} placeholder={t.selling.footerNote} disabled={off} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-paper">{t.selling.paper}</Label>
            <Select value={s.receipt.paper} onValueChange={(v) => setS({ ...s, receipt: { ...s.receipt, paper: v as "58" | "80" } })} disabled={off}>
              <SelectTrigger id="r-paper" className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="80">
                  <span dir="ltr">80 mm</span>
                </SelectItem>
                <SelectItem value="58">
                  <span dir="ltr">58 mm</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <FormError message={error} />
        {canChange && (
          <Button onClick={save} disabled={busy}>
            {busy ? t.common.saving : t.common.saveChanges}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
