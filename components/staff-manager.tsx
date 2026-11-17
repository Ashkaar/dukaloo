"use client";

import { PencilIcon, PlusIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { MAX_STAFF_NAME_LENGTH, MIN_PASSWORD_LENGTH, STAFF_SECTIONS, type Section } from "@/lib/sections";
import type { StaffUser } from "@/lib/staff";
import { ConfirmDialog } from "./confirm-dialog";
import { FormError } from "./form-error";
import { useI18n } from "./i18n-provider";
import { NAV } from "./nav";
import { PageBody, PageHeader } from "./page-header";
import { PasswordInput } from "./password-input";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

export function StaffManager({ initial }: { initial: StaffUser[] }) {
  const { t, date } = useI18n();
  const [staff, setStaff] = useState(initial);
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);

  const saved = (user: StaffUser) => {
    setStaff((list) => {
      const rest = list.filter((s) => s.id !== user.id);
      return [...rest, user].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditing(null);
    toast.success(t.common.saved);
  };

  const remove = async () => {
    if (!deleting) return;
    await sendJson(`/api/staff/${deleting.id}`, "DELETE");
    setStaff((list) => list.filter((s) => s.id !== deleting.id));
    setDeleting(null);
  };

  return (
    <PageBody>
      <PageHeader title={t.staff.title} description={t.staff.intro}>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {t.staff.add}
        </Button>
      </PageHeader>

      {staff.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <UserRoundIcon className="size-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">{t.staff.none}</p>
          <Button variant="soft" onClick={() => setEditing("new")}>
            <PlusIcon />
            {t.staff.add}
          </Button>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {staff.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-soft-foreground">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{s.name}</span>
                  {!s.active && <Badge variant="neutral">{t.staff.inactive}</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.permissions.length > 0 ? s.permissions.map((p) => NAV[p].label(t)).join(" · ") : "—"} · {t.staff.since(date(s.createdAt))}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={t.staff.editTitle(s.name)} onClick={() => setEditing(s)}>
                  <PencilIcon />
                </Button>
                <Button variant="destructive-ghost" size="icon-sm" aria-label={t.staff.deleteTitle(s.name)} onClick={() => setDeleting(s)}>
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && <StaffDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? t.staff.deleteTitle(deleting.name) : ""}
        description={t.staff.deleteText}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={remove}
      />
    </PageBody>
  );
}

function StaffDialog({ user, onClose, onSaved }: { user: StaffUser | null; onClose: () => void; onSaved: (user: StaffUser) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Section[]>(user?.permissions ?? ["dashboard"]);
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (s: Section, on: boolean) => setPermissions((list) => (on ? [...list, s] : list.filter((x) => x !== s)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!user || password) && password.length < MIN_PASSWORD_LENGTH) return setError(t.ownerPassword.tooShort(MIN_PASSWORD_LENGTH));
    setBusy(true);
    setError(null);
    try {
      const body = user
        ? { name: name.trim(), permissions, active, ...(password ? { password } : {}) }
        : { name: name.trim(), password, permissions };
      const { user: savedUser } = await sendJson<{ user: StaffUser }>(user ? `/api/staff/${user.id}` : "/api/staff", user ? "PATCH" : "POST", body);
      onSaved(savedUser);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{user ? t.staff.editTitle(user.name) : t.staff.newTitle}</DialogTitle>
          <DialogDescription className="sr-only">{t.staff.intro}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-name">{t.staff.name}</Label>
            <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_STAFF_NAME_LENGTH} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-password">{user ? t.staff.newPassword : t.staff.password}</Label>
            <PasswordInput id="staff-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={100} required={!user} />
            {user && <p className="text-xs text-muted-foreground">{t.staff.keepPassword}</p>}
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t.staff.sections}</legend>
            <div className="grid grid-cols-2 gap-2">
              {STAFF_SECTIONS.map((s) => (
                <Label key={s} className="cursor-pointer rounded-lg border border-border px-3 py-2.5 font-normal hover:bg-highlight">
                  <Checkbox checked={permissions.includes(s)} onCheckedChange={(on) => toggle(s, on === true)} />
                  {NAV[s].label(t)}
                </Label>
              ))}
            </div>
          </fieldset>
          {user && (
            <Label className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
              {t.staff.active}
              <Switch checked={active} onCheckedChange={setActive} />
            </Label>
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
