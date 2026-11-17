"use client";

import { BellIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { shopKey, shopSince } from "@/lib/shopBase";
import { updatesSince, type Update } from "@/lib/updates";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

const READ_KEY = "dukaloo-updates-read";

function readIds(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(shopKey(READ_KEY)) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// "What's new": the changes made since this shop was created, with a dot
// until they've been seen on this device.
export function UpdatesBell() {
  const { t, date } = useI18n();
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [read, setRead] = useState<string[]>([]);

  useEffect(() => {
    // Read after mount: the list depends on this device's storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state
    setUpdates(updatesSince(shopSince()));
    setRead(readIds());
  }, []);

  const unread = useMemo(() => updates.filter((u) => !read.includes(u.id)).length, [updates, read]);

  const show = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) {
      const ids = updates.map((u) => u.id as string);
      try {
        localStorage.setItem(shopKey(READ_KEY), JSON.stringify(ids));
      } catch {
        // Private mode: the dot comes back next time.
      }
      setRead(ids);
    }
  };

  const items = t.updates.items as Record<string, { title: string; text: string }>;

  return (
    <Sheet open={open} onOpenChange={show}>
      <Button variant="ghost" size="icon" className="relative" aria-label={t.updates.title} onClick={() => show(true)}>
        <BellIcon className="size-5" />
        {unread > 0 && <span className="absolute end-2 top-2 size-2 rounded-full bg-accent-500 ring-2 ring-card" />}
      </Button>
      <SheetContent side="end" closeLabel={t.common.close} className="p-5">
        <SheetTitle>{t.updates.title}</SheetTitle>
        {updates.length === 0 ? (
          <SheetDescription>{t.updates.none}</SheetDescription>
        ) : (
          <ul className="space-y-4">
            {updates.map((u) => (
              <li key={u.id} className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">{date(Date.parse(u.at))}</p>
                <p className="mt-1 font-semibold">{items[u.id]?.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{items[u.id]?.text}</p>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
