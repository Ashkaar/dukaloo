"use client";

import type { Dir, Messages } from "@/lib/i18n";
import type { Sale, SaleReturn, SalesSettings } from "@/lib/sale";

// Prints a receipt in its own window, sized for 58 or 80 mm receipt paper.
// The browser's print window opens; with Chrome's --kiosk-printing it goes
// straight to the default printer. A cash drawer wired to the receipt
// printer opens when the printer driver is set to "open drawer on print".

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface ReceiptContext {
  t: Messages;
  dir: Dir;
  money: (cents: number) => string;
  quantity: (milli: number) => string;
  dateTime: (ms: number) => string;
  shopName: string;
  branch: string;
  settings: SalesSettings;
}

// `title` replaces "Receipt #n" (a return slip uses its own).
export function receiptHtml(sale: Sale, ctx: ReceiptContext, title?: string): string {
  const { t, money, quantity } = ctx;
  const r = t.receipt;
  const rate = `${sale.taxRateBp / 100}%`;
  const lines = sale.lines
    .map((l) => {
      const name = [l.name, l.variantLabel].filter(Boolean).join(" · ");
      const qty = `${quantity(l.qtyMilli)} × ${money(l.unitPriceCents)}`;
      const discount = l.discountCents ? `<div class="row sub"><span>${esc(r.discount)}</span><span>-${esc(money(l.discountCents))}</span></div>` : "";
      return `<div class="item"><div class="name">${esc(name)}</div><div class="row sub"><span>${esc(qty)}</span><span>${esc(money(l.totalCents))}</span></div>${discount}</div>`;
    })
    .join("");
  const row = (label: string, value: string, cls = "") => `<div class="row ${cls}"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
  const totals = [
    row(r.subtotal, money(sale.subtotalCents)),
    sale.discountCents ? row(r.discount, `-${money(sale.discountCents)}`) : "",
    sale.taxCents && !sale.taxInclusive ? row(`${sale.taxName} ${rate}`, money(sale.taxCents)) : "",
    row(r.total, money(sale.totalCents), "total"),
    sale.taxCents && sale.taxInclusive ? row(r.taxIncluded(sale.taxName, rate), money(sale.taxCents), "sub") : "",
  ].join("");
  const payments = sale.payments.map((p) => row(t.till.methods[p.method], money(p.cents))).join("") + (sale.changeCents ? row(r.change, money(sale.changeCents)) : "");
  const width = ctx.settings.receipt.paper === "58" ? 58 : 80;
  const css = `@page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; }
    body { width: ${width}mm; padding: 3mm ${width === 58 ? 2 : 4}mm 6mm; font: ${width === 58 ? 10 : 11}pt/1.3 system-ui, "Segoe UI", Tahoma, sans-serif; color: #000; }
    .center { text-align: center; }
    .shop { font-size: 1.25em; font-weight: 800; }
    .pre { white-space: pre-line; unicode-bidi: plaintext; }
    .rule { border-top: 1px dashed #000; margin: 2mm 0; }
    .row { display: flex; justify-content: space-between; gap: 2mm; }
    .row span:last-child { direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
    .sub { font-size: 0.9em; }
    .item { margin-bottom: 1.2mm; }
    .name { font-weight: 600; }
    .total { font-size: 1.3em; font-weight: 800; margin-top: 1mm; }
    .void { text-align: center; font-size: 1.4em; font-weight: 800; border: 2px solid #000; margin: 2mm 0; }`;
  const shop = [ctx.shopName, ctx.branch].filter(Boolean).join(" · ");
  return `<!doctype html><html dir="${ctx.dir}"><head><meta charset="utf-8"><title>${esc(r.receipt)} #${sale.number}</title><style>${css}</style></head><body>
    <div class="center"><div class="shop">${esc(shop)}</div>${ctx.settings.receipt.header ? `<div class="pre sub">${esc(ctx.settings.receipt.header)}</div>` : ""}</div>
    <div class="rule"></div>
    ${row(title ?? `${r.receipt} #${sale.number}`, ctx.dateTime(sale.at), "sub")}
    ${sale.staffName ? row(r.cashier, sale.staffName, "sub") : ""}
    ${sale.customerName ? row(r.customer, sale.customerName, "sub") : ""}
    ${sale.status === "voided" ? `<div class="void">${esc(r.voided)}</div>` : ""}
    <div class="rule"></div>${lines}<div class="rule"></div>${totals}<div class="rule"></div>${payments}
    ${sale.note ? `<div class="rule"></div><div class="pre sub">${esc(sale.note)}</div>` : ""}
    ${ctx.settings.receipt.footer ? `<div class="rule"></div><div class="center pre sub">${esc(ctx.settings.receipt.footer)}</div>` : ""}
  </body></html>`;
}

function printHtml(html: string): void {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.setTimeout(() => {
    win.print();
    win.close();
  }, 200);
}

export function printReceipt(sale: Sale, ctx: ReceiptContext): void {
  printHtml(receiptHtml(sale, ctx));
}

// A slip for a return: what came back and what was refunded.
export function printReturnSlip(sale: Sale, ret: SaleReturn, ctx: ReceiptContext): void {
  const byLine = new Map(sale.lines.map((l) => [l.id, l]));
  const slip: Sale = {
    ...sale,
    status: "done",
    lines: ret.lines.map((rl) => {
      const l = byLine.get(rl.saleLineId)!;
      return { ...l, qtyMilli: rl.qtyMilli, totalCents: rl.refundCents, discountCents: 0, unitPriceCents: Math.round((rl.refundCents * 1000) / rl.qtyMilli) };
    }),
    subtotalCents: ret.refundCents,
    discountCents: 0,
    taxCents: 0,
    totalCents: ret.refundCents,
    payments: [{ method: ret.method, cents: ret.refundCents }],
    changeCents: 0,
    note: ret.note,
    at: ret.at,
    staffName: ret.staffName,
  };
  printHtml(receiptHtml(slip, ctx, ctx.t.returns.slip(sale.number)));
}
