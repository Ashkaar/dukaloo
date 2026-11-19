"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { QuantityInput } from "../money-input";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type Mode = "set" | "add" | "remove";

// A quick stock change for one variant: the shelf count, or items added or removed.
export function StockDialog({ variantId, label, level, onClose, onSaved }: { variantId: number; label: string; level: number; onClose: () => void; onSaved: (milli: number) => void }) {
  const { t, quantity } = useI18n();
  const [mode, setMode] = useState<Mode>("set");
  const [qty, setQty] = useState<number | null>(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (qty === null) return setError(t.errors.invalid);
    setBusy(true);
    setError(null);
    try {
      const { stockMilli } = await sendJson<{ stockMilli: number }>("/api/stock/adjust", "POST", { variantId, mode, qtyMilli: qty, note: note.trim() });
      toast.success(t.stock.saved);
      onSaved(stockMilli);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.stock.adjustTitle(label)}</DialogTitle>
          <DialogDescription>{t.stock.now(quantity(level))}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {(["set", "add", "remove"] as const).map((m) => (
            <Button key={m} variant={mode === m ? "default" : "outline"} size="sm" onClick={() => setMode(m)}>
              {t.stock[m]}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock-qty">{t.stock.qty}</Label>
          <QuantityInput id="stock-qty" milli={0} onChange={setQty} className="h-12 text-lg" autoFocus />
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.stock.note} aria-label={t.stock.note} maxLength={200} />
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={save} disabled={busy || qty === null}>
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
