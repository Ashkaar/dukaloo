"use client";

import { CheckCircle2Icon, PrinterIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Sale, SalesSettings } from "@/lib/sale";
import { useI18n } from "../i18n-provider";
import { printReceipt } from "../sales/print-receipt";
import { useShop } from "../shop-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

// After a sale: change to give back, print the receipt, start the next sale.
export function ReceiptDialog({ sale, settings, onClose }: { sale: Sale; settings: SalesSettings; onClose: () => void }) {
  const i18n = useI18n();
  const { t, money } = i18n;
  const shop = useShop();
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus(), []);

  const print = () => printReceipt(sale, { ...i18n, shopName: shop.name, branch: shop.branch, settings });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="items-center pe-0 text-center">
          <CheckCircle2Icon className="size-12 text-primary" />
          <DialogTitle>{t.till.done}</DialogTitle>
          <DialogDescription>{t.till.receiptNo(sale.number)}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-muted px-4 py-3">
          <p className="tabular text-2xl font-extrabold">{money(sale.totalCents)}</p>
          {sale.changeCents > 0 && (
            <p className="mt-1 text-lg font-bold text-primary">
              {t.till.change}: <span className="tabular">{money(sale.changeCents)}</span>
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Button variant="outline" size="lg" onClick={print}>
            <PrinterIcon />
            {t.till.print}
          </Button>
          <Button ref={next} size="touch" onClick={onClose}>
            {t.till.newSale}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
