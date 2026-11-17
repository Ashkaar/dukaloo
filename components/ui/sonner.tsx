"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// Toasts (sonner), placed at the top on phones so the bottom bar stays free.
export function Toaster({ dir, ...props }: ToasterProps) {
  return (
    <Sonner
      dir={dir}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "!rounded-lg !font-sans" } }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
