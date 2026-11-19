"use client";

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, getJson } from "@/lib/clientApi";
import type { Report } from "@/lib/reportsDb";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { SalesChart } from "./sales-chart";

type Preset = "today" | "yesterday" | "week" | "month" | "lastMonth" | "year" | "custom";

const back = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

function rangeOf(preset: Preset, today: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  switch (preset) {
    case "today":
      return [today, today];
    case "yesterday":
      return [back(today, 1), back(today, 1)];
    case "week":
      return [back(today, 6), today];
    case "lastMonth": {
      const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      return [first, back(`${today.slice(0, 7)}-01`, 1)];
    }
    case "year":
      return [`${y}-01-01`, today];
    default:
      return [`${today.slice(0, 7)}-01`, today];
  }
}

export function ReportsScreen({ today, first }: { today: string; first: Report }) {
  const { t, money, quantity } = useI18n();
  const [report, setReport] = useState(first);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [loading, setLoading] = useState(false);

  const load = async (f: string, tt: string) => {
    if (!f || !tt || f > tt) return;
    setLoading(true);
    try {
      setReport((await getJson<{ report: Report }>(`/api/reports?from=${f}&to=${tt}`)).report);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setLoading(false);
    }
  };
  const choose = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const [f, tt] = rangeOf(p, today);
    setFrom(f);
    setTo(tt);
    load(f, tt);
  };

  const exportCsv = () => {
    const rows = [["day", "net", "sales"], ...report.byDay.map((d) => [d.day, (d.netCents / 100).toFixed(2), String(d.count)])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales-${report.from}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = report.sales;
  const minus = (cents: number) => (cents ? `-${money(cents)}` : money(0));
  const presets: Preset[] = ["today", "yesterday", "week", "month", "lastMonth", "year", "custom"];
  const methodTotal = Object.values(report.byMethod).reduce((a, b) => a + b, 0);

  return (
    <PageBody>
      <PageHeader title={t.reports.title} description={t.reports.intro}>
        <Button variant="outline" onClick={exportCsv} className="no-print">
          <DownloadIcon />
          {t.reports.csv}
        </Button>
        <Button variant="outline" onClick={() => window.print()} className="no-print">
          <PrinterIcon />
          {t.reports.print}
        </Button>
      </PageHeader>

      <div className="no-print flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => choose(p)}
            className={cn("h-9 cursor-pointer rounded-full border px-4 text-sm font-medium", preset === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-highlight")}
          >
            {t.reports.presets[p]}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" dir="ltr" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label={t.reports.from} className="w-40" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" dir="ltr" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} aria-label={t.reports.to} className="w-40" />
            <Button onClick={() => load(from, to)} disabled={!from || !to || from > to}>
              {t.reports.show}
            </Button>
          </div>
        )}
      </div>

      <div className={cn("space-y-4", loading && "opacity-60")}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={t.reports.netSales} value={money(s.netCents)} note={t.reports.salesCount(s.count)} strong />
          <Tile label={t.reports.grossProfit} value={money(s.grossProfitCents)} note={s.revenueCents ? t.reports.margin(Math.round((s.grossProfitCents / s.revenueCents) * 100)) : undefined} />
          <Tile label={t.reports.netProfit} value={money(s.netProfitCents)} note={t.reports.afterExpenses} negative={s.netProfitCents < 0} />
          <Tile label={t.reports.average} value={money(s.averageCents)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t.reports.byDay}</CardTitle>
            </CardHeader>
            <CardContent>{report.byDay.length > 1 ? <SalesChart days={report.byDay} /> : <p className="text-sm text-muted-foreground">{t.reports.oneDay}</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t.reports.breakdown}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1.5 text-sm">
                <Row label={t.reports.gross} value={money(s.grossCents)} />
                <Row label={t.reports.refunds} value={minus(s.refundCents)} />
                <Row label={t.reports.netSales} value={money(s.netCents)} strong />
                <Row label={t.reports.tax} value={minus(s.taxCents)} />
                <Row label={t.reports.cost} value={minus(s.costCents)} />
                <Row label={t.reports.grossProfit} value={money(s.grossProfitCents)} strong />
                <Row label={t.reports.expenses} value={minus(s.expenseCents)} />
                <Row label={t.reports.netProfit} value={money(s.netProfitCents)} strong />
                <p className="pt-2 text-xs text-muted-foreground">{t.reports.discountsGiven(money(s.discountCents))}</p>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Table title={t.reports.topProducts} empty={t.reports.noData} head={[t.reports.product, t.reports.qty, t.reports.revenue, t.reports.profit]}>
            {report.topProducts.map((p, i) => (
              <tr key={i}>
                <td className="py-1.5 pe-2">{[p.name, p.variantLabel].filter(Boolean).join(" · ")}</td>
                <td className="tabular py-1.5 text-end">{quantity(p.qtyMilli)}</td>
                <td className="tabular py-1.5 text-end">{money(p.revenueCents)}</td>
                <td className="tabular py-1.5 text-end">{money(p.profitCents)}</td>
              </tr>
            ))}
          </Table>
          <div className="space-y-4">
            <Table title={t.reports.byMethod} empty={t.reports.noData} head={[t.reports.method, t.reports.amount]}>
              {methodTotal !== 0 &&
                (["cash", "card", "transfer"] as const).map((m) => (
                  <tr key={m}>
                    <td className="py-1.5">{t.till.methods[m]}</td>
                    <td className="tabular py-1.5 text-end">{money(report.byMethod[m])}</td>
                  </tr>
                ))}
            </Table>
            <Table title={t.reports.byCategory} empty={t.reports.noData} head={[t.reports.category, t.reports.revenue]}>
              {report.byCategory.map((c, i) => (
                <tr key={i}>
                  <td className="py-1.5">{c.name || t.products.noCategory}</td>
                  <td className="tabular py-1.5 text-end">{money(c.revenueCents)}</td>
                </tr>
              ))}
            </Table>
          </div>
          <Table title={t.reports.byStaff} empty={t.reports.noData} head={[t.reports.person, t.reports.salesLabel, t.reports.amount]}>
            {report.byStaff.map((p, i) => (
              <tr key={i}>
                <td className="py-1.5">{p.name || t.header.owner}</td>
                <td className="tabular py-1.5 text-end">{p.count}</td>
                <td className="tabular py-1.5 text-end">{money(p.totalCents)}</td>
              </tr>
            ))}
          </Table>
          <Table title={t.reports.expensesByType} empty={t.reports.noData} head={[t.expenses.type, t.reports.amount]}>
            {report.expensesByType.map((e, i) => (
              <tr key={i}>
                <td className="py-1.5">{e.name || t.expenses.noType}</td>
                <td className="tabular py-1.5 text-end">{money(e.cents)}</td>
              </tr>
            ))}
          </Table>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Tile label={t.reports.stockAtCost} value={money(report.stock.costValueCents)} note={t.reports.now} />
          <Tile label={t.reports.stockAtPrice} value={money(report.stock.priceValueCents)} note={t.reports.now} />
          <Table title={t.reports.lowStock} empty={t.reports.noLowStock} head={[t.reports.product, t.stock.inStock]}>
            {report.stock.low.map((l, i) => (
              <tr key={i}>
                <td className="py-1.5">{[l.name, l.variantLabel].filter(Boolean).join(" · ")}</td>
                <td className={cn("tabular py-1.5 text-end font-semibold", l.stockMilli <= 0 ? "text-red-600 dark:text-red-400" : "text-accent-700 dark:text-accent-400")}>{quantity(l.stockMilli)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </PageBody>
  );
}

function Tile({ label, value, note, strong = false, negative = false }: { label: string; value: string; note?: string; strong?: boolean; negative?: boolean }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 truncate font-extrabold", strong ? "text-2xl" : "text-xl", negative && "text-red-600 dark:text-red-400")}>{value}</p>
      {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
    </Card>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong ? "border-t border-border pt-1.5 font-bold" : "text-muted-foreground")}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function Table({ title, head, empty, children }: { title: string; head: string[]; empty: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {rows.length === 0 || (Array.isArray(children) && children.length === 0) ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {head.map((h, i) => (
                  <th key={i} className={cn("pb-1.5 font-medium", i === 0 ? "text-start" : "text-end")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">{children}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

