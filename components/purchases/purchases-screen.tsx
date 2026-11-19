"use client";

import { PencilIcon, PlusIcon, Trash2Icon, TruckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getJson, sendJson } from "@/lib/clientApi";
import type { PurchaseSummary, Supplier } from "@/lib/purchases";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../confirm-dialog";
import { CustomerDialog } from "../customers/customer-dialog";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type Page = { items: PurchaseSummary[]; total: number };

// Purchases and suppliers, as two tabs.
export function PurchasesScreen({ first, suppliers: initialSuppliers }: { first: Page; suppliers: Supplier[] }) {
  const { t, money, date } = useI18n();
  const shop = useShop();
  const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");
  const [items, setItems] = useState(first.items);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const more = async () => {
    const page = await getJson<Page>(`/api/purchases?offset=${items.length}`);
    setItems((l) => [...l, ...page.items]);
  };

  const tabClass = (on: boolean) => cn("h-9 cursor-pointer rounded-md px-4 text-sm font-medium", on ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground");

  return (
    <PageBody>
      <PageHeader title={t.purchases.title} description={t.purchases.intro}>
        {tab === "purchases" ? (
          <Button asChild>
            <Link href={shop.href("/dashboard/purchases/new")}>
              <PlusIcon />
              {t.purchases.add}
            </Link>
          </Button>
        ) : (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            {t.purchases.newSupplier}
          </Button>
        )}
      </PageHeader>
      <div role="tablist" className="inline-flex rounded-lg bg-muted p-1">
        <button type="button" role="tab" aria-selected={tab === "purchases"} className={tabClass(tab === "purchases")} onClick={() => setTab("purchases")}>
          {t.purchases.title}
        </button>
        <button type="button" role="tab" aria-selected={tab === "suppliers"} className={tabClass(tab === "suppliers")} onClick={() => setTab("suppliers")}>
          {t.purchases.suppliers}
        </button>
      </div>

      {tab === "purchases" ? (
        items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <TruckIcon className="size-10 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">{t.purchases.none}</p>
          </Card>
        ) : (
          <>
            <Card className="divide-y divide-border">
              {items.map((p) => (
                <Link key={p.id} href={shop.href(`/dashboard/purchases/${p.id}`)} className="flex items-center gap-3 px-4 py-3 hover:bg-highlight sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      #{p.number} {p.supplierName && <span className="truncate font-normal">· {p.supplierName}</span>}
                      {p.status === "cancelled" && <Badge variant="destructive">{t.purchases.cancelled}</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{[date(p.at), t.sales.items(p.itemCount), p.reference].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={cn("tabular font-bold", p.status === "cancelled" && "text-muted-foreground line-through")}>{money(p.totalCents)}</span>
                </Link>
              ))}
            </Card>
            {items.length < first.total && (
              <Button variant="outline" onClick={more}>
                {t.products.loadMore}
              </Button>
            )}
          </>
        )
      ) : suppliers.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-muted-foreground">{t.purchases.noSuppliers}</Card>
      ) : (
        <Card className="divide-y divide-border">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[s.phone, s.email].filter(Boolean).join(" · ") || " "}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`${t.common.edit} ${s.name}`} onClick={() => setEditing(s)}>
                <PencilIcon />
              </Button>
              <Button variant="destructive-ghost" size="icon-sm" aria-label={`${t.common.delete} ${s.name}`} onClick={() => setDeleting(s)}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <CustomerDialog
          kind="supplier"
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(s) => {
            setSuppliers((list) => [...list.filter((x) => x.id !== s.id), s].sort((a, b) => a.name.localeCompare(b.name)));
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? t.purchases.deleteSupplier(deleting.name) : ""}
        description={t.purchases.deleteSupplierText}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`/api/suppliers/${deleting!.id}`, "DELETE");
          setSuppliers((list) => list.filter((x) => x.id !== deleting!.id));
          setDeleting(null);
        }}
      />
    </PageBody>
  );
}
