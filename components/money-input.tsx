"use client";

import { useState } from "react";
import { MILLI, parseMoney, parseQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useShop } from "./shop-provider";
import { Input } from "./ui/input";

const centsToText = (cents: number, decimals: 0 | 2) =>
  decimals === 2 ? `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}` : String(Math.round(cents / 100));

// An amount in the shop's currency. Shows what was typed; reports whole
// cents (or null while the text isn't a valid amount).
export function MoneyInput({
  cents,
  onChange,
  className,
  showCurrency = true,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  cents: number;
  onChange: (cents: number | null) => void;
  // Off in tables, where the column heading names the currency.
  showCurrency?: boolean;
}) {
  const { decimals, currency } = useShop();
  const [textValue, setText] = useState(() => (cents ? centsToText(cents, decimals) : ""));
  const [lastCents, setLastCents] = useState(cents);
  // Follow changes made from outside (e.g. "Same price for all").
  if (cents !== lastCents) {
    setLastCents(cents);
    if (parseMoney(textValue || "0", decimals) !== cents) setText(cents ? centsToText(cents, decimals) : "");
  }
  const invalid = textValue !== "" && parseMoney(textValue, decimals) === null;
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        value={textValue}
        placeholder={decimals === 2 ? "0.00" : "0"}
        aria-invalid={invalid || undefined}
        className={cn("tabular text-end", showCurrency && "pe-12", className)}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = e.target.value.trim() === "" ? 0 : parseMoney(e.target.value, decimals);
          if (parsed !== null) setLastCents(parsed);
          onChange(parsed);
        }}
        {...props}
      />
      {showCurrency && <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">{currency}</span>}
    </div>
  );
}

// A quantity in units (thousandths inside).
export function QuantityInput({
  milli,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & { milli: number; onChange: (milli: number | null) => void }) {
  const [textValue, setText] = useState(() => (milli ? String(milli / MILLI) : ""));
  const invalid = textValue !== "" && parseQuantity(textValue) === null;
  return (
    <Input
      inputMode="decimal"
      dir="ltr"
      autoComplete="off"
      value={textValue}
      placeholder="0"
      aria-invalid={invalid || undefined}
      className={cn("tabular text-end", className)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.trim() === "" ? 0 : parseQuantity(e.target.value));
      }}
      {...props}
    />
  );
}
