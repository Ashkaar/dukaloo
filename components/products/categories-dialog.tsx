"use client";

import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { LIMITS, type Category } from "@/lib/catalog";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError } from "../form-error";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);

// Add, rename and delete categories.
export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onChange: (categories: Category[]) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { category } = await sendJson<{ category: Category }>("/api/categories", "POST", { name: name.trim() });
      onChange([...categories, category].sort(byName));
      setName("");
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/categories/${editing.id}`, "PATCH", { name: editing.name.trim() });
      onChange(categories.map((c) => (c.id === editing.id ? { ...c, name: editing.name.trim() } : c)).sort(byName));
      setEditing(null);
    } catch (err) {
      setError(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    await sendJson(`/api/categories/${deleting.id}`, "DELETE");
    onChange(categories.filter((c) => c.id !== deleting.id));
    setDeleting(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent closeLabel={t.common.close}>
          <DialogHeader>
            <DialogTitle>{t.products.categories}</DialogTitle>
            <DialogDescription>{t.products.categoriesIntro}</DialogDescription>
          </DialogHeader>
          <form onSubmit={add} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.products.newCategory} aria-label={t.products.categoryName} maxLength={LIMITS.category} />
            <Button type="submit" disabled={busy || !name.trim()}>
              <PlusIcon />
              {t.common.add}
            </Button>
          </form>
          <FormError message={error} />
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t.products.noCategories}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  {editing?.id === c.id ? (
                    <form
                      className="flex flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        rename();
                      }}
                    >
                      <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} aria-label={t.products.categoryName} maxLength={LIMITS.category} className="h-9" />
                      <Button type="submit" size="icon-sm" variant="ghost" aria-label={t.common.save} disabled={busy}>
                        <CheckIcon />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={t.common.cancel} onClick={() => setEditing(null)}>
                        <XIcon />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{t.products.productsIn(c.productCount)}</p>
                      </div>
                      <Button size="icon-sm" variant="ghost" aria-label={`${t.common.edit} ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                        <PencilIcon />
                      </Button>
                      <Button size="icon-sm" variant="destructive-ghost" aria-label={t.products.deleteCategoryTitle(c.name)} onClick={() => setDeleting(c)}>
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
        title={deleting ? t.products.deleteCategoryTitle(deleting.name) : ""}
        description={t.products.deleteCategoryText}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={remove}
      />
    </>
  );
}
