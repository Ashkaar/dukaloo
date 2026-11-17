"use client";

import { LockKeyholeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { PageBody } from "./page-header";
import { PasswordInput } from "./password-input";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

// Shown on an owner screen to a staff login: the owner types their
// password to open owner screens on this device for two hours.
export function UnlockGate() {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendJson("/api/unlock", "POST", { password });
      toast.success(t.unlock.unlocked);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageBody>
      <Card className="mx-auto mt-10 max-w-sm">
        <CardContent className="space-y-4 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
            <LockKeyholeIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold">{t.unlock.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.unlock.text}</p>
          </div>
          <form onSubmit={submit} className="space-y-3 text-start">
            <PasswordInput aria-label={t.ownerPassword.title} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={100} required />
            <FormError message={error} />
            <Button type="submit" className="w-full" disabled={busy || !password}>
              {t.unlock.button}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageBody>
  );
}
