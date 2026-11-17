"use client";

import { CrownIcon } from "lucide-react";
import { useState } from "react";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { cn } from "@/lib/utils";
import { AuthFrame } from "./auth-frame";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { PasswordInput } from "./password-input";
import { useShop } from "./shop-provider";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

type Who = "owner" | number;

// Sign-in at the shop's address: pick your name (big tiles, easy on a
// touch till), type your password.
export function LoginForm({ staff, ownerReady }: { staff: { id: number; name: string }[]; ownerReady: boolean }) {
  const { t } = useI18n();
  const shop = useShop();
  const [who, setWho] = useState<Who | null>(staff.length === 0 ? "owner" : null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (who === null || !password) return;
    setBusy(true);
    setError(null);
    try {
      const { home } = await sendJson<{ home: string }>("/api/auth/login", "POST", { user: who, password });
      window.location.assign(shop.href(home));
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  const tile = (selected: boolean) =>
    cn(
      "flex h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 text-start text-sm font-semibold transition-colors",
      selected ? "border-primary bg-primary-soft text-primary-soft-foreground ring-1 ring-primary" : "border-border hover:bg-highlight",
    );

  return (
    <AuthFrame title={t.auth.signInTitle}>
      <form onSubmit={submit} className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t.auth.who}</legend>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={tile(who === "owner")} onClick={() => setWho("owner")} aria-pressed={who === "owner"}>
              <CrownIcon className="size-4 shrink-0 text-accent-600" />
              <span className="truncate">{t.auth.owner}</span>
            </button>
            {staff.map((s) => (
              <button key={s.id} type="button" className={tile(who === s.id)} onClick={() => setWho(s.id)} aria-pressed={who === s.id}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {who === "owner" && !ownerReady ? (
          <p className="rounded-lg bg-accent-50 px-3 py-2.5 text-sm text-accent-900 dark:bg-accent-500/10 dark:text-accent-200">{t.auth.noOwnerYet}</p>
        ) : (
          who !== null && (
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={100}
                required
              />
            </div>
          )
        )}

        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy || who === null || !password || (who === "owner" && !ownerReady)}>
          {busy ? t.auth.signingIn : t.auth.signIn}
        </Button>
      </form>
    </AuthFrame>
  );
}
