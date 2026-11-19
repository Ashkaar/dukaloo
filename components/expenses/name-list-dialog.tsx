"use client";

import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

interface Named {
  id: number;
  name: string;
}

// A short list of names the shop keeps (expense types): add, rename, delete.
export function NameListDialog<T extends Named>({
  open,
  onOpenChange,
  endpoint,
  responseKey,
  items,
  onChange,
  texts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  endpoint: string;
  responseKey: string;
  items: T[];
  onChange: (items: T[]) => void;
  texts: { title: string; intro: string; placeholder: string; none: string; deleteTitle: (name: string) => string; deleteText: string };
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = (list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent closeLabel={t.common.close}>
          <DialogHeader>
            <DialogTitle>{texts.title}</DialogTitle>
            <DialogDescription>{texts.intro}</DialogDescription>
          </DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              run(async () => {
                const res = await sendJson<Record<string, T>>(endpoint, "POST", { name: name.trim() });
                onChange(sorted([...items, res[responseKey]]));
                setName("");
              });
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={texts.placeholder} aria-label={texts.placeholder} maxLength={60} />
            <Button type="submit" disabled={busy || !name.trim()}>
              <PlusIcon />
              {t.common.add}
            </Button>
          </form>
          <FormError message={error} />
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{texts.none}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 px-3 py-2">
                  {editing?.id === it.id ? (
                    <form
                      className="flex flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                          await sendJson(`${endpoint}/${it.id}`, "PATCH", { name: editing.name.trim() });
                          onChange(sorted(items.map((x) => (x.id === it.id ? { ...x, name: editing.name.trim() } : x))));
                          setEditing(null);
                        });
                      }}
                    >
                      <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: it.id, name: e.target.value })} maxLength={60} className="h-9" aria-label={texts.placeholder} />
                      <Button type="submit" size="icon-sm" variant="ghost" aria-label={t.common.save} disabled={busy}>
                        <CheckIcon />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={t.common.cancel} onClick={() => setEditing(null)}>
                        <XIcon />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.name}</span>
                      <Button size="icon-sm" variant="ghost" aria-label={`${t.common.edit} ${it.name}`} onClick={() => setEditing({ id: it.id, name: it.name })}>
                        <PencilIcon />
                      </Button>
                      <Button size="icon-sm" variant="destructive-ghost" aria-label={texts.deleteTitle(it.name)} onClick={() => setDeleting(it)}>
                        <Trash2Icon />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? texts.deleteTitle(deleting.name) : ""}
        description={texts.deleteText}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          await sendJson(`${endpoint}/${deleting!.id}`, "DELETE");
          onChange(items.filter((x) => x.id !== deleting!.id));
          setDeleting(null);
        }}
      />
    </>
  );
}
