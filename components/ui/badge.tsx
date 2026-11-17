import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-primary-soft text-primary-soft-foreground",
      neutral: "bg-muted text-muted-foreground",
      accent: "bg-accent-100 text-accent-800 dark:bg-accent-500/15 dark:text-accent-300",
      destructive: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
