"use client";

import { ContactRoundIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CustomerSummary } from "@/lib/customers";
import { getJson } from "@/lib/clientApi";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { CustomerDialog } from "./customer-dialog";

type Page = { items: CustomerSummary[]; total: number };

export function CustomerList({ first }: { first: Page }) {
  const { t, money, date } = useI18n();
  const shop = useShop();
  const router = useRouter();
  const [items, setItems] = useState(first.items);
  const [total, setTotal] = useState(first.total);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await getJson<Page>(`/api/customers?q=${encodeURIComponent(q)}`);
        if (!cancelled) {
          setItems(page.items);
          setTotal(page.total);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const more = async () => {
    setLoading(true);
    try {
      const page = await getJson<Page>(`/api/customers?q=${encodeURIComponent(q)}&offset=${items.length}`);
      setItems((l) => [...l, ...page.items]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageBody>
      <PageHeader title={t.customers.title} description={t.customers.intro}>
        <Button onClick={() => setAdding(true)}>
          <PlusIcon />
          {t.customers.add}
        </Button>
      </PageHeader>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.customers.search} aria-label={t.customers.search} className="ps-9" maxLength={80} />
      </div>
      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <ContactRoundIcon className="size-10 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">{loading ? t.common.loading : q ? t.customers.noneFound : t.customers.none}</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {items.map((c) => (
            <Link key={c.id} href={shop.href(`/dashboard/customers/${c.id}`)} className="flex items-center gap-3 px-4 py-3 hover:bg-highlight sm:px-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-soft-foreground">{c.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[c.phone && <bdi key="p">{c.phone}</bdi>, t.customers.visits(c.visits), c.lastVisit ? t.customers.lastVisit(date(c.lastVisit)) : ""].filter(Boolean).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, " · ", x] : [x]), [])}
                </p>
              </div>
              <span className="text-end">
                <span className="tabular block text-sm font-bold">{money(c.spentCents)}</span>
                {c.balanceCents > 0 && <span className="tabular block text-xs font-semibold text-accent-700 dark:text-accent-400">{t.credit.owes(money(c.balanceCents))}</span>}
              </span>
            </Link>
          ))}
        </Card>
      )}
      {items.length < total && (
        <Button variant="outline" onClick={more} disabled={loading}>
          {t.products.loadMore}
        </Button>
      )}
      {adding && <CustomerDialog customer={null} onClose={() => setAdding(false)} onSaved={(c) => router.push(shop.href(`/dashboard/customers/${c.id}`))} />}
    </PageBody>
  );
}
