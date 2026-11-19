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

// An A4 invoice for a sale: shop and customer details, a table of items,
// totals with tax, and how it was paid.
export function printInvoice(sale: Sale, ctx: ReceiptContext): void {
  const { t, money, quantity } = ctx;
  const iv = t.invoice;
  const rate = `${sale.taxRateBp / 100}%`;
  const rows = sale.lines
    .map(
      (l, i) => `<tr><td>${i + 1}</td><td>${esc([l.name, l.variantLabel].filter(Boolean).join(" · "))}</td><td class="n">${esc(quantity(l.qtyMilli))}</td>
        <td class="n">${esc(money(l.unitPriceCents))}</td><td class="n">${l.discountCents ? esc(money(l.discountCents)) : ""}</td><td class="n">${esc(money(l.totalCents))}</td></tr>`,
    )
    .join("");
  const sum = (label: string, value: string, cls = "") => `<tr class="${cls}"><td>${esc(label)}</td><td class="n">${esc(value)}</td></tr>`;
  const totals = [
    sum(t.receipt.subtotal, money(sale.subtotalCents)),
    sale.discountCents ? sum(t.receipt.discount, `-${money(sale.discountCents)}`) : "",
    sale.taxCents && !sale.taxInclusive ? sum(`${sale.taxName} ${rate}`, money(sale.taxCents)) : "",
    sum(t.receipt.total, money(sale.totalCents), "grand"),
    sale.taxCents && sale.taxInclusive ? sum(t.receipt.taxIncluded(sale.taxName, rate), money(sale.taxCents), "muted") : "",
    sale.refundedCents ? sum(iv.refunded, `-${money(sale.refundedCents)}`, "muted") : "",
  ].join("");
  const paid = sale.payments.map((p) => `${esc(t.till.methods[p.method])}: ${esc(money(p.cents))}`).join(" · ");
  const shop = [ctx.shopName, ctx.branch].filter(Boolean).join(" · ");
  const css = `@page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; margin: 0; }
    body { font: 10.5pt/1.45 system-ui, "Segoe UI", Tahoma, sans-serif; color: #111; }
    header { display: flex; justify-content: space-between; gap: 12mm; border-bottom: 2px solid #111; padding-bottom: 5mm; }
    h1 { font-size: 22pt; letter-spacing: 0.02em; }
    .shop { font-size: 13pt; font-weight: 700; }
    .pre { white-space: pre-line; unicode-bidi: plaintext; color: #444; }
    .meta { text-align: end; }
    .parties { display: flex; justify-content: space-between; gap: 12mm; margin: 7mm 0; }
    .label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin-bottom: 1mm; }
    table { width: 100%; border-collapse: collapse; }
    .items th { text-align: start; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #111; padding: 2mm 1.5mm; }
    .items td { border-bottom: 1px solid #ddd; padding: 2mm 1.5mm; vertical-align: top; }
    .n { text-align: end; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
    .items th.n { text-align: end; }
    .totals { width: 45%; margin-inline-start: auto; margin-top: 5mm; }
    .totals td { padding: 1.2mm 1.5mm; }
    .grand td { font-size: 13pt; font-weight: 800; border-top: 2px solid #111; }
    .muted td { color: #666; font-size: 9pt; }
    footer { margin-top: 10mm; border-top: 1px solid #ddd; padding-top: 4mm; }
    .void { display: inline-block; border: 2px solid #b00; color: #b00; font-weight: 800; padding: 1mm 3mm; margin-top: 2mm; }`;
  const html = `<!doctype html><html dir="${ctx.dir}"><head><meta charset="utf-8"><title>${esc(iv.number(sale.number))}</title><style>${css}</style></head><body>
    <header>
      <div><div class="shop">${esc(shop)}</div>${ctx.settings.receipt.header ? `<div class="pre">${esc(ctx.settings.receipt.header)}</div>` : ""}</div>
      <div class="meta"><h1>${esc(iv.title)}</h1><div>${esc(iv.number(sale.number))}</div><div>${esc(ctx.dateTime(sale.at))}</div>
        ${sale.status === "voided" ? `<div class="void">${esc(t.receipt.voided)}</div>` : ""}</div>
    </header>
    <div class="parties">
      <div><div class="label">${esc(iv.billTo)}</div>${sale.customerName ? `<div><b>${esc(sale.customerName)}</b></div>${sale.customerPhone ? `<div dir="ltr" style="text-align:start">${esc(sale.customerPhone)}</div>` : ""}${sale.customerAddress ? `<div>${esc(sale.customerAddress)}</div>` : ""}` : `<div>${esc(iv.walkIn)}</div>`}</div>
      ${sale.staffName ? `<div class="meta"><div class="label">${esc(t.receipt.cashier)}</div><div>${esc(sale.staffName)}</div></div>` : ""}
    </div>
    <table class="items"><thead><tr><th>#</th><th>${esc(iv.item)}</th><th class="n">${esc(iv.qty)}</th><th class="n">${esc(iv.price)}</th><th class="n">${esc(t.receipt.discount)}</th><th class="n">${esc(iv.amount)}</th></tr></thead><tbody>${rows}</tbody></table>
    <table class="totals"><tbody>${totals}</tbody></table>
    <footer><div><span class="label">${esc(iv.paid)}</span> ${paid}</div>${sale.note ? `<div class="pre">${esc(sale.note)}</div>` : ""}${ctx.settings.receipt.footer ? `<div class="pre" style="margin-top:3mm">${esc(ctx.settings.receipt.footer)}</div>` : ""}</footer>
  </body></html>`;
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}
