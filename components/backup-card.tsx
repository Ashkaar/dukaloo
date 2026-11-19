"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, getJson } from "@/lib/clientApi";
import { useI18n } from "./i18n-provider";
import { useShop } from "./shop-provider";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

// A copy of all the shop's data in one JSON file. The server sends it a
// table and a page at a time; the file is put together here.
export function BackupCard() {
  const { t } = useI18n();
  const shop = useShop();
  const [progress, setProgress] = useState<string | null>(null);

  const download = async () => {
    try {
      const { tables } = await getJson<{ tables: string[] }>("/api/backup");
      const data: Record<string, unknown[]> = {};
      for (const table of tables) {
        setProgress(table);
        data[table] = [];
        let after = 0;
        for (;;) {
          const page = await getJson<{ rows: unknown[]; next: number | null }>(`/api/backup?table=${table}&after=${after}`);
          data[table].push(...page.rows);
          if (page.next === null) break;
          after = page.next;
        }
      }
      const file = { app: "dukaloo", version: 1, exportedAt: new Date().toISOString(), shop: { name: shop.name, branch: shop.branch, currency: shop.currency, decimals: shop.decimals }, tables: data };
      const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const slug = (shop.base.slice(1) || "shop").replace(/[^a-z0-9-]/g, "");
      a.download = `dukaloo-${slug}-${file.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(t.backup.done);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t.backup.title}</CardTitle>
          <CardDescription className="mt-1">{t.backup.intro}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" onClick={download} disabled={progress !== null}>
          <DownloadIcon />
          {progress ? t.backup.working : t.backup.download}
        </Button>
      </CardContent>
    </Card>
  );
}
