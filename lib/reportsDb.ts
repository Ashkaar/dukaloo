import "server-only";
import { totalOwed } from "./customersDb";
import { getShopDb } from "./db";
import { dayOf, dayStart, nextDay } from "./format";
import { emptyByMethod, type SaleMethod } from "./sale";

// The owner's report for a run of days, worked out in SQL so it stays fast
// for a whole year of sales. Voided sales are left out; returns count on the
// day they were given; tax collected is not income.

export interface Report {
  from: string;
  to: string;
  sales: {
    count: number;
    grossCents: number;
    refundCents: number;
    netCents: number;
    discountCents: number;
    taxCents: number;
    revenueCents: number;
    costCents: number;
    grossProfitCents: number;
    expenseCents: number;
    netProfitCents: number;
    averageCents: number;
  };
  byMethod: Record<SaleMethod, number>;
  // Repayments from customers in the period (included in byMethod's money
  // methods), and what all customers owe right now.
  receivedCents: number;
  owedCents: number;
  byDay: { day: string; netCents: number; count: number }[];
  topProducts: { name: string; variantLabel: string; qtyMilli: number; revenueCents: number; profitCents: number }[];
  byCategory: { name: string; revenueCents: number }[];
  byStaff: { name: string; count: number; totalCents: number }[];
  expensesByType: { name: string; cents: number }[];
  stock: { costValueCents: number; priceValueCents: number; low: { name: string; variantLabel: string; stockMilli: number; lowStockMilli: number }[] };
}

const n = (v: unknown) => Number(v ?? 0);
const parse = (raw: unknown): string[] => {
  try {
    const v: unknown = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

// `from` and `to` are calendar days, both included.
export async function buildReport(from: string, to: string, timeZone: string): Promise<Report> {
  const { client } = await getShopDb();
  const start = dayStart(from, timeZone);
  const end = dayStart(nextDay(to), timeZone);
  const live = "s.status = 'done' AND s.at >= ? AND s.at < ?";
  const range = [start, end];
  const q = async (sql: string, args: (string | number)[] = range) => (await client.execute({ sql, args })).rows;

  const [totals, refunds, cost, returnedCost, payments, change, refundByMethod, daySales, dayRefunds, top, categories, staff, expenses, expenseTypes, stockValue, low, received, owed] =
    await Promise.all([
      q(`SELECT COUNT(*) AS c, COALESCE(SUM(total_cents),0) AS gross, COALESCE(SUM(discount_cents),0) AS disc, COALESCE(SUM(tax_cents),0) AS tax
         FROM sales s WHERE ${live}`),
      // Refunds given in the period, and the tax inside them.
      q(`SELECT COALESCE(SUM(r.refund_cents),0) AS refund,
                COALESCE(SUM(CASE WHEN s.total_cents > 0 THEN r.refund_cents * s.tax_cents * 1.0 / s.total_cents ELSE 0 END),0) AS tax
         FROM sale_returns r JOIN sales s ON s.id = r.sale_id WHERE r.at >= ? AND r.at < ?`),
      q(`SELECT COALESCE(SUM(l.cost_cents * l.qty_milli / 1000.0),0) AS cost FROM sale_lines l JOIN sales s ON s.id = l.sale_id WHERE ${live}`),
      q(`SELECT COALESCE(SUM(l.cost_cents * rl.qty_milli / 1000.0),0) AS cost
         FROM sale_return_lines rl JOIN sale_returns r ON r.id = rl.return_id JOIN sale_lines l ON l.id = rl.sale_line_id
         WHERE r.at >= ? AND r.at < ?`),
      q(`SELECT p.method, COALESCE(SUM(p.amount_cents),0) AS cents FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${live} GROUP BY p.method`),
      q(`SELECT COALESCE(SUM(change_cents),0) AS cents FROM sales s WHERE ${live}`),
      q(`SELECT method, COALESCE(SUM(refund_cents),0) AS cents FROM sale_returns WHERE at >= ? AND at < ? GROUP BY method`),
      q(`SELECT s.at, s.total_cents FROM sales s WHERE ${live}`),
      q(`SELECT at, refund_cents FROM sale_returns WHERE at >= ? AND at < ?`),
      q(`SELECT l.variant_id, MAX(l.name) AS name, MAX(l.variant_label) AS label, SUM(l.qty_milli) AS qty, SUM(l.total_cents) AS revenue,
                SUM(l.total_cents - l.cost_cents * l.qty_milli / 1000.0) AS profit
         FROM sale_lines l JOIN sales s ON s.id = l.sale_id WHERE ${live}
         GROUP BY l.variant_id ORDER BY revenue DESC LIMIT 15`),
      q(`SELECT COALESCE(c.name, '') AS name, SUM(l.total_cents) AS revenue
         FROM sale_lines l JOIN sales s ON s.id = l.sale_id
         LEFT JOIN products p ON p.id = l.product_id LEFT JOIN categories c ON c.id = p.category_id
         WHERE ${live} GROUP BY c.id ORDER BY revenue DESC`),
      q(`SELECT s.staff_name AS name, COUNT(*) AS c, SUM(s.total_cents) AS total FROM sales s WHERE ${live} GROUP BY s.staff_name ORDER BY total DESC`),
      q(`SELECT COALESCE(SUM(amount_cents),0) AS cents FROM expenses WHERE deleted_at IS NULL AND day >= ? AND day <= ?`, [from, to]),
      q(`SELECT COALESCE(t.name, '') AS name, SUM(e.amount_cents) AS cents FROM expenses e LEFT JOIN expense_types t ON t.id = e.type_id
         WHERE e.deleted_at IS NULL AND e.day >= ? AND e.day <= ? GROUP BY t.id ORDER BY cents DESC`, [from, to]),
      // Stock today, valued at cost and at selling price (counted, live items with stock).
      q(`SELECT COALESCE(SUM(lv.qty * v.cost_cents / 1000.0),0) AS cost, COALESCE(SUM(lv.qty * v.price_cents / 1000.0),0) AS price
         FROM (SELECT variant_id, SUM(qty_milli) AS qty FROM stock_moves GROUP BY variant_id) lv
         JOIN product_variants v ON v.id = lv.variant_id JOIN products p ON p.id = v.product_id
         WHERE lv.qty > 0 AND p.track_stock = 1 AND v.archived_at IS NULL AND p.archived_at IS NULL`, []),
      q(`SELECT p.name, v.options, COALESCE(lv.qty, 0) AS qty, v.low_stock_milli AS low
         FROM product_variants v JOIN products p ON p.id = v.product_id
         LEFT JOIN (SELECT variant_id, SUM(qty_milli) AS qty FROM stock_moves GROUP BY variant_id) lv ON lv.variant_id = v.id
         WHERE p.track_stock = 1 AND v.archived_at IS NULL AND p.archived_at IS NULL AND v.active = 1 AND p.active = 1
           AND v.low_stock_milli > 0 AND COALESCE(lv.qty, 0) <= v.low_stock_milli
         ORDER BY COALESCE(lv.qty, 0) - v.low_stock_milli LIMIT 50`, []),
      q(`SELECT method, COALESCE(SUM(amount_cents),0) AS cents FROM customer_payments WHERE deleted_at IS NULL AND at >= ? AND at < ? GROUP BY method`),
      totalOwed(),
    ]);

  const count = n(totals[0]?.c);
  const gross = n(totals[0]?.gross);
  const refund = n(refunds[0]?.refund);
  const tax = Math.round(n(totals[0]?.tax) - n(refunds[0]?.tax));
  const net = gross - refund;
  const revenue = net - tax;
  const costCents = Math.round(n(cost[0]?.cost) - n(returnedCost[0]?.cost));
  const grossProfit = revenue - costCents;
  const expenseCents = n(expenses[0]?.cents);

  const byMethod: Record<SaleMethod, number> = emptyByMethod();
  for (const r of payments) if (String(r.method) in byMethod) byMethod[String(r.method) as SaleMethod] += n(r.cents);
  byMethod.cash -= n(change[0]?.cents);
  for (const r of refundByMethod) if (String(r.method) in byMethod) byMethod[String(r.method) as SaleMethod] -= n(r.cents);
  let receivedCents = 0;
  for (const r of received) {
    receivedCents += n(r.cents);
    if (String(r.method) in byMethod) byMethod[String(r.method) as SaleMethod] += n(r.cents);
  }

  // Every day in the range, also the quiet ones.
  const days = new Map<string, { netCents: number; count: number }>();
  for (let d = from; d <= to && days.size < 400; d = nextDay(d)) days.set(d, { netCents: 0, count: 0 });
  for (const r of daySales) {
    const d = days.get(dayOf(n(r.at), timeZone));
    if (d) {
      d.netCents += n(r.total_cents);
      d.count++;
    }
  }
  for (const r of dayRefunds) {
    const d = days.get(dayOf(n(r.at), timeZone));
    if (d) d.netCents -= n(r.refund_cents);
  }

  return {
    from,
    to,
    sales: {
      count,
      grossCents: gross,
      refundCents: refund,
      netCents: net,
      discountCents: n(totals[0]?.disc),
      taxCents: tax,
      revenueCents: revenue,
      costCents,
      grossProfitCents: grossProfit,
      expenseCents,
      netProfitCents: grossProfit - expenseCents,
      averageCents: count ? Math.round(gross / count) : 0,
    },
    byMethod,
    receivedCents,
    owedCents: owed,
    byDay: [...days].map(([day, v]) => ({ day, ...v })),
    topProducts: top.map((r) => ({ name: String(r.name), variantLabel: String(r.label ?? ""), qtyMilli: n(r.qty), revenueCents: n(r.revenue), profitCents: Math.round(n(r.profit)) })),
    byCategory: categories.map((r) => ({ name: String(r.name), revenueCents: n(r.revenue) })),
    byStaff: staff.map((r) => ({ name: String(r.name), count: n(r.c), totalCents: n(r.total) })),
    expensesByType: expenseTypes.map((r) => ({ name: String(r.name), cents: n(r.cents) })),
    stock: {
      costValueCents: Math.round(n(stockValue[0]?.cost)),
      priceValueCents: Math.round(n(stockValue[0]?.price)),
      low: low.map((r) => ({ name: String(r.name), variantLabel: parse(r.options).join(" / "), stockMilli: n(r.qty), lowStockMilli: n(r.low) })),
    },
  };
}
