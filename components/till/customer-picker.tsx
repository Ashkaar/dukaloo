"use client";

import { PlusIcon, SearchIcon, UserRoundXIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { CustomerSummary } from "@/lib/customers";
import { getJson } from "@/lib/clientApi";
import { CustomerDialog } from "../customers/customer-dialog";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

export interface PickedCustomer {
  id: number;
  name: string;
  // What they owe already (credit sales), when known.
  balanceCents: number;
}

// Find a customer by name or phone for this sale, or add one on the spot.
export function CustomerPicker({ current, onClose, onPick }: { current: PickedCustomer | null; onClose: () => void; onPick: (c: PickedCustomer | null) => void }) {
  const { t, money } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const page = await getJson<{ items: CustomerSummary[] }>(`/api/customers?limit=8&q=${encodeURIComponent(q)}`);
        if (!cancelled) setResults(page.items);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  if (adding) {
    return <CustomerDialog customer={null} quick initialName={q} onClose={() => setAdding(false)} onSaved={(c) => onPick({ id: c.id, name: c.name, balanceCents: 0 })} />;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.customers.pickTitle}</DialogTitle>
          <DialogDescription>{t.customers.pickIntro}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.customers.search} aria-label={t.customers.search} className="h-11 ps-9" maxLength={80} />
        </div>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {results.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">{t.customers.noneFound}</li>}
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick({ id: c.id, name: c.name, balanceCents: c.balanceCents })}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-start hover:bg-highlight"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  {c.phone && <bdi className="block text-xs text-muted-foreground">{c.phone}</bdi>}
                </span>
                {c.balanceCents > 0 && <span className="tabular shrink-0 text-xs font-semibold text-accent-700 dark:text-accent-400">{t.credit.owes(money(c.balanceCents))}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-between gap-2">
          {current ? (
            <Button variant="ghost" onClick={() => onPick(null)}>
              <UserRoundXIcon />
              {t.customers.noCustomer}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="soft" onClick={() => setAdding(true)}>
            <PlusIcon />
            {t.customers.add}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
