"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { errorMessage, sendJson } from "@/lib/clientApi";
import { DEVICE } from "@/lib/timeZone";
import { useI18n } from "./i18n-provider";
import { useShop } from "./shop-provider";
import { deviceTimeZone } from "./time-zone-sync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const noop = () => () => {};

function allZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Asia/Baghdad", "Asia/Tehran", "Asia/Dubai", "Asia/Riyadh", "Europe/Istanbul", "Europe/London", "Europe/Berlin", "UTC"];
  }
}

// The shop's time zone: each device's own (the default), or one zone for all.
export function TimeZoneCard({ canChange }: { canChange: boolean }) {
  const { t } = useI18n();
  const { timeZoneSetting } = useShop();
  const router = useRouter();
  const device = useSyncExternalStore(noop, deviceTimeZone, () => "");
  const [value, setValue] = useState(timeZoneSetting);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => {
    const list = allZones();
    return value !== DEVICE && !list.includes(value) ? [value, ...list] : list;
  }, [value]);

  const choose = async (next: string) => {
    const before = value;
    setValue(next);
    setBusy(true);
    try {
      await sendJson("/api/settings/time-zone", "PUT", { timeZone: next });
      toast.success(t.common.saved);
      router.refresh();
    } catch (err) {
      setValue(before);
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t.settings.timeZone}</CardTitle>
          <CardDescription className="mt-1">{t.settings.timeZoneNote}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={value} onValueChange={choose} disabled={!canChange || busy}>
          <SelectTrigger aria-label={t.settings.timeZone}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value={DEVICE}>{t.settings.timeZoneDevice}</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                <span dir="ltr">{z.replace(/_/g, " ")}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {device && (
            <span className="me-2 inline-block">{t.settings.timeZoneDeviceIs(device)}</span>
          )}
          {!canChange && t.settings.timeZoneOwnerOnly}
        </p>
      </CardContent>
    </Card>
  );
}
