"use client";

import { PrinterIcon } from "lucide-react";
import { useState } from "react";
import { barcodeType, variantLabel, type Product } from "@/lib/catalog";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

// Label stock: a roll of single labels for a label printer, or an A4 sheet.
const SIZES = {
  "50x30": { page: "50mm 30mm", w: 50, h: 30, perRow: 1 },
  "38x25": { page: "38mm 25mm", w: 38, h: 25, perRow: 1 },
  a4: { page: "A4", w: 70, h: 37, perRow: 3 },
} as const;
type Size = keyof typeof SIZES;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function LabelsDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product: Product }) {
  const { t, money, dir } = useI18n();
  const withCode = product.variants.filter((v) => v.barcode);
  const [copies, setCopies] = useState<Record<number, number>>({});
  const [size, setSize] = useState<Size>("50x30");
  const [showPrice, setShowPrice] = useState(true);
  const count = (id: number) => copies[id] ?? 1;

  const print = async () => {
    const { toSVG } = await import("bwip-js/browser");
    const s = SIZES[size];
    const labels: string[] = [];
    for (const v of withCode) {
      const svg = toSVG({ bcid: barcodeType(v.barcode), text: v.barcode, includetext: true, textsize: 9, height: s.h > 26 ? 10 : 8, scale: 2 });
      const title = [product.name, variantLabel(v)].filter(Boolean).join(" · ");
      const label = `<div class="label"><div class="name">${escape(title)}</div>${showPrice ? `<div class="price">${escape(money(v.priceCents))}</div>` : ""}<div class="code">${svg}</div></div>`;
      for (let i = 0; i < count(v.id); i++) labels.push(label);
    }
    const css = `@page { size: ${s.page}; margin: ${size === "a4" ? "10mm 0" : "0"}; }
      * { box-sizing: border-box; margin: 0; }
      body { font-family: system-ui, sans-serif; color: #000; }
      .sheet { display: grid; grid-template-columns: repeat(${s.perRow}, ${s.w}mm); justify-content: center; }
      .label { width: ${s.w}mm; height: ${s.h}mm; padding: 1.5mm 2mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      ${size === "a4" ? "" : ".label { page-break-after: always; break-after: page; }"}
      .name { font-size: ${s.h > 26 ? 9 : 7.5}pt; font-weight: 600; text-align: center; line-height: 1.15; max-height: 2.3em; overflow: hidden; }
      .price { font-size: ${s.h > 26 ? 11 : 9}pt; font-weight: 800; direction: ltr; }
      .code { flex: 1; min-height: 0; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
      .code svg { max-width: 100%; max-height: 100%; height: auto; }`;
    const win = window.open("", "_blank", "width=480,height=640");
    if (!win) return;
    win.document.write(
      `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${escape(t.products.labelsTitle)}</title><style>${css}</style></head><body><div class="sheet">${labels.join("")}</div></body></html>`,
    );
    win.document.close();
    win.focus();
    // Give the SVGs a moment to lay out, then open the print window.
    win.setTimeout(() => {
      win.print();
      win.close();
    }, 250);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.products.labelsTitle}</DialogTitle>
          <DialogDescription>{t.products.labelsIntro}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {product.variants.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{variantLabel(v) || product.name}</p>
                <p dir="ltr" className="truncate text-start font-mono text-xs text-muted-foreground">
                  {v.barcode || t.products.noBarcode}
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={500}
                value={v.barcode ? count(v.id) : 0}
                disabled={!v.barcode}
                onChange={(e) => setCopies((c) => ({ ...c, [v.id]: Math.max(0, Math.min(500, Math.floor(Number(e.target.value) || 0))) }))}
                aria-label={`${t.products.copies} ${variantLabel(v) || product.name}`}
                className="h-9 w-20 text-center"
              />
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="label-size">{t.products.labelSize}</Label>
            <Select value={size} onValueChange={(v) => setSize(v as Size)}>
              <SelectTrigger id="label-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50x30">{t.products.size50x30}</SelectItem>
                <SelectItem value="38x25">{t.products.size38x25}</SelectItem>
                <SelectItem value="a4">{t.products.sizeA4}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label className="flex cursor-pointer items-center justify-between gap-3 self-end rounded-lg border border-border px-3 py-2.5">
            {t.products.showPrice}
            <Switch checked={showPrice} onCheckedChange={setShowPrice} />
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={print} disabled={withCode.every((v) => count(v.id) === 0)}>
            <PrinterIcon />
            {t.products.print}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
