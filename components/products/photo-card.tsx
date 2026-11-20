"use client";

import { CameraIcon, ImagePlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, errorMessage, sendFile, sendJson } from "@/lib/clientApi";
import { useI18n } from "../i18n-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ProductPhoto, squarePhoto } from "./product-photo";

// The photo of a product in the editor. For a saved product the photo is
// stored at once; for a new one it is kept here (`onPending`) and stored
// right after the product is first saved.
export function PhotoCard({
  productId,
  version,
  onChange,
  onPending,
}: {
  productId: number | null;
  version: number;
  onChange: (version: number) => void;
  onPending: (photo: Blob | null) => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await squarePhoto(file);
      if (productId === null) {
        onPending(photo);
        setPreview(URL.createObjectURL(photo));
      } else {
        const { imageVersion } = await sendFile<{ imageVersion: number }>(`/api/products/${productId}/image`, photo);
        onChange(imageVersion);
        toast.success(t.photos.saved);
      }
    } catch (err) {
      // The server's message if it refused it; otherwise the picture couldn't be read.
      toast.error(err instanceof ApiError ? errorMessage(err, t.photos.unreadable) : t.photos.unreadable);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (productId === null) {
      onPending(null);
      setPreview(null);
      return;
    }
    setBusy(true);
    try {
      await sendJson(`/api/products/${productId}/image`, "DELETE");
      onChange(0);
    } catch (err) {
      toast.error(errorMessage(err, t.common.somethingWrong));
    } finally {
      setBusy(false);
    }
  };

  const has = preview !== null || (productId !== null && version > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.photos.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="mx-auto aspect-square w-full max-w-56 overflow-hidden rounded-xl border border-border">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local preview
            <img src={preview} alt={t.photos.title} className="size-full object-cover" />
          ) : (
            <ProductPhoto productId={productId ?? 0} version={productId ? version : 0} className="size-full" iconClassName="size-10" />
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <CameraIcon />
            {t.photos.take}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlusIcon />
            {has ? t.photos.change : t.photos.choose}
          </Button>
          {has && (
            <Button type="button" variant="destructive-ghost" size="sm" disabled={busy} onClick={remove}>
              <Trash2Icon />
              {t.photos.remove}
            </Button>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">{busy ? t.photos.working : t.photos.note}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.photos.choose}
          data-testid="photo-file"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.photos.take}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </CardContent>
    </Card>
  );
}
