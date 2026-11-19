"use client";

import { ArrowLeftIcon, MailIcon, MapPinIcon, PencilIcon, PhoneIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Customer, CustomerPayment } from "@/lib/customers";
import { CustomerAccount } from "./customer-account";
import { sendJson } from "@/lib/clientApi";
import type { SaleSummary } from "@/lib/sale";
import { ConfirmDialog } from "../confirm-dialog";
import { useI18n } from "../i18n-provider";
import { PageBody } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CustomerDialog } from "./customer-dialog";

export interface AccountInfo {
  balanceCents: number;
  payments: CustomerPayment[];
  creditEnabled: boolean;
  canDelete: boolean;
}

export function CustomerPage({ customer: initial, sales, account }: { customer: Customer; sales: SaleSummary[]; account?: AccountInfo }) {
  const { t, money, dateTime } = useI18n();
  const shop = useShop();
  const router = useRouter();
  const [customer, setCustomer] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const live = sales.filter((s) => s.status === "done");
  const spent = live.reduce((s, x) => s + x.totalCents, 0) - sales.reduce((s, x) => s + x.refundedCents, 0);

  const remove = async () => {
    await sendJson(`/api/customers/${customer.id}`, "DELETE");
    toast.success(t.customers.deleted);
    router.push(shop.href("/dashboard/customers"));
  };

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t.customers.back}>
          <Link href={shop.href("/dashboard/customers")}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">{customer.name}</h1>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <PencilIcon />
          {t.common.edit}
        </Button>
        <Button variant="destructive-ghost" size="icon" aria-label={t.common.delete} onClick={() => setDeleting(true)}>
          <Trash2Icon />
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="h-fit">
          <CardContent className="space-y-3 text-sm">
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-2 hover:text-primary">
                <PhoneIcon className="size-4 text-muted-foreground" />
                <bdi>{customer.phone}</bdi>
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2 break-all hover:text-primary">
                <MailIcon className="size-4 shrink-0 text-muted-foreground" />
                {customer.email}
              </a>
            )}
            {customer.address && (
              <p className="flex items-center gap-2">
                <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                {customer.address}
              </p>
            )}
            {customer.note && <p className="rounded-lg bg-muted px-3 py-2 whitespace-pre-line text-muted-foreground">{customer.note}</p>}
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div>
                <p className="text-xs text-muted-foreground">{t.customers.spent}</p>
                <p className="tabular text-lg font-bold">{money(spent)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.customers.visitsLabel}</p>
                <p className="tabular text-lg font-bold">{live.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="min-w-0 space-y-4 lg:col-span-2">
        {account && (account.creditEnabled || account.balanceCents !== 0 || account.payments.length > 0) && <CustomerAccount customerId={customer.id} initial={account} />}
        <Card>
          <CardHeader>
            <CardTitle>{t.customers.history}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {sales.length === 0 ? (
              <p className="px-5 pb-4 text-sm text-muted-foreground">{t.customers.noSales}</p>
            ) : (
              <ul className="divide-y divide-border">
                {sales.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="font-semibold">#{s.number}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {dateTime(s.at)} · {t.sales.items(s.itemCount)}
                    </span>
                    {s.status === "voided" && <Badge variant="destructive">{t.sales.voided}</Badge>}
                    {s.refundedCents > 0 && <Badge variant="accent">{t.returns.returned}</Badge>}
                    <span className="tabular font-bold">{money(s.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
      {editing && (
        <CustomerDialog
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={(c) => {
            setCustomer(c);
            setEditing(false);
            toast.success(t.common.saved);
          }}
        />
      )}
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={t.customers.deleteTitle(customer.name)} description={t.customers.deleteText} confirmLabel={t.common.delete} destructive onConfirm={remove} />
    </PageBody>
  );
}
