"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { productImagePath, PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_PX } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useShop } from "../shop-provider";

// A product's photo, or a plain placeholder when it has none (or it can't
// load, e.g. offline and never seen on this device).
export function ProductPhoto({ productId, version, className, iconClassName }: { productId: number; version: number; className?: string; iconClassName?: string }) {
  const { href } = useShop();
  const [failed, setFailed] = useState<string | null>(null);
  const src = version ? href(productImagePath(productId, version)) : null;
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden bg-muted text-muted-foreground", className)}>
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own API, already small
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" onError={() => setFailed(src)} />
      ) : (
        <ImageIcon className={cn("size-5 opacity-50", iconClassName)} aria-hidden />
      )}
    </span>
  );
}

// Turns a picture from the camera or a file into a small square photo:
// the middle of the picture, PRODUCT_IMAGE_PX on each side, as WebP (or
// JPEG where the browser can't make WebP). Throws if it can't be read.
export async function squarePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(PRODUCT_IMAGE_PX, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  for (const quality of [0.82, 0.7, 0.55]) {
    let blob = await encode("image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", quality);
    if (blob && blob.size <= PRODUCT_IMAGE_MAX_BYTES) return blob;
  }
  throw new Error("too big");
}
