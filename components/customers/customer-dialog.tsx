"use client";

import { useState } from "react";
import type { Customer } from "@/lib/customers";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

// Add or edit a customer. `quick` (from the till) asks only for name and phone.
export function CustomerDialog({
  customer,
  initialName = "",
  quick = false,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  initialName?: string;
  quick?: boolean;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const { t } = useI18n();
  const digits = /^[+\d\s]{3,}$/.test(initialName);
  const [name, setName] = useState(customer?.name ?? (digits ? "" : initialName));
  const [phone, setPhone] = useState(customer?.phone ?? (digits ? initialName : ""));
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [note, setNote] = useState(customer?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), phone, email: email.trim(), address: address.trim(), note: note.trim() };
      const { customer: saved } = await sendJson<{ customer: Customer }>(customer ? `/api/customers/${customer.id}` : "/api/customers", customer ? "PUT" : "POST", body);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{customer ? t.customers.editTitle : t.customers.newTitle}</DialogTitle>
          <DialogDescription className="sr-only">{t.customers.intro}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">{t.customers.name}</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">{t.customers.phone}</Label>
              <Input id="c-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </div>
          </div>
          {!quick && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="c-email">{t.customers.email}</Label>
                  <Input id="c-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-address">{t.customers.address}</Label>
                  <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-note">{t.customers.note}</Label>
                <Textarea id="c-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </div>
            </>
          )}
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
