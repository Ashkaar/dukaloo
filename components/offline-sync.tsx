"use client";

import { CloudUploadIcon, TriangleAlertIcon, WifiOffIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { discard, flush, onOutboxChange, pending, type OutboxItem } from "@/lib/outbox";
import { SECTION_HREF, type Section } from "@/lib/sections";
import { useI18n } from "./i18n-provider";
import { useOnline } from "./online-status";
import { useShop } from "./shop-provider";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

// Registers the service worker, saves this login's screens on the device
// while online, and sends what was recorded offline when the connection
// is back (on reconnect, every 30 seconds, and when the app opens).
export function OfflineSync({ sections }: { sections: readonly Section[] }) {
  const shop = useShop();
  const online = useOnline();
  const { t } = useI18n();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async () => {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: "warm", urls: sections.map((s) => shop.href(SECTION_HREF[s])) });
      })
      .catch(() => {});
  }, [sections, shop]);

  useEffect(() => {
    if (!online) return;
    let stop = false;
    const run = async () => {
      if (stop) return;
      const { sent } = await flush();
      if (sent > 0) toast.success(t.offline.synced(sent));
    };
    run();
    const timer = setInterval(run, 30_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [online, t]);

  return null;
}

// "Offline" and "N waiting to send" in the header, with the list on tap.
export function OutboxStatus() {
  const { t, money, dateTime } = useI18n();
  const online = useOnline();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    pending().then(setItems);
  }, []);
  useEffect(() => {
    refresh();
    return onOutboxChange(refresh);
  }, [refresh]);

  const failed = items.filter((i) => i.error);
  if (online && items.length === 0) return null;

  const amount = (i: OutboxItem) => {
    const b = i.body as { expectedTotalCents?: number; amountCents?: number };
    return money(b.expectedTotalCents ?? b.amountCents ?? 0);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent-100 px-2 py-1 text-xs font-semibold text-accent-800 dark:bg-accent-500/15 dark:text-accent-300"
      >
        {failed.length > 0 ? <TriangleAlertIcon className="size-3.5" /> : online ? <CloudUploadIcon className="size-3.5" /> : <WifiOffIcon className="size-3.5" />}
        {!online && t.header.offline}
        {items.length > 0 && <span>{t.offline.waiting(items.length)}</span>}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="end" closeLabel={t.common.close} className="p-5">
          <SheetTitle>{t.offline.title}</SheetTitle>
          <SheetDescription>{online ? t.offline.introOnline : t.offline.introOffline}</SheetDescription>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.offline.nothing}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{t.offline.kinds[i.kind]}</span>
                    <span className="tabular font-semibold">{amount(i)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{dateTime(i.createdAt)}</p>
                  {i.error && (
                    <div className="mt-2 flex items-start justify-between gap-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <span>{i.error}</span>
                      <Button variant="destructive-ghost" size="sm" onClick={() => discard(i.id!)}>
                        {t.offline.discard}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {online && items.some((i) => !i.error) && (
            <Button onClick={() => flush()}>
              <CloudUploadIcon />
              {t.offline.sendNow}
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
