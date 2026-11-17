"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { MIN_OWNER_PASSWORD_LENGTH } from "@/lib/sections";
import { AuthFrame } from "./auth-frame";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { PasswordInput } from "./password-input";
import { useShop } from "./shop-provider";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

export function OwnerPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useI18n();
  const shop = useShop();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_OWNER_PASSWORD_LENGTH) return setError(t.ownerPassword.tooShort(MIN_OWNER_PASSWORD_LENGTH));
    if (password !== confirm) return setError(t.ownerPassword.mismatch);
    setBusy(true);
    setError(null);
    try {
      await sendJson("/api/owner-password", "POST", hasPassword ? { current, password } : { password });
      toast.success(t.ownerPassword.done);
      window.location.assign(shop.href("/dashboard"));
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title={hasPassword ? t.ownerPassword.title : t.ownerPassword.chooseTitle}
      intro={hasPassword ? t.ownerPassword.changeIntro : t.ownerPassword.chooseIntro}
    >
      <form onSubmit={submit} className="space-y-4">
        {hasPassword && (
          <div className="space-y-2">
            <Label htmlFor="current">{t.ownerPassword.current}</Label>
            <PasswordInput id="current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} maxLength={100} required />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="new">{t.ownerPassword.new}</Label>
          <PasswordInput id="new" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={100} required />
          <p className="text-xs text-muted-foreground">{t.ownerPassword.tooShort(MIN_OWNER_PASSWORD_LENGTH)}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t.ownerPassword.confirm}</Label>
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={100} required />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? t.common.saving : t.common.save}
        </Button>
        {hasPassword && (
          <Button type="button" variant="ghost" className="w-full" onClick={() => window.history.back()}>
            {t.common.cancel}
          </Button>
        )}
      </form>
    </AuthFrame>
  );
}
