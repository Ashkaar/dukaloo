"use client";

import { useEffect, useRef } from "react";
import { toLatinDigits } from "@/lib/format";

// USB and Bluetooth barcode scanners act as a keyboard: they "type" the
// code very fast and press Enter. This hook notices that pattern while no
// text field has focus, and hands over the code. (When a field has focus,
// the scanner simply types into it, which is what a barcode field wants.)

const MAX_GAP_MS = 50; // between keystrokes of one scan
const MIN_LENGTH = 4;

export function useScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = e.timeStamp;
      if (now - last > MAX_GAP_MS) buffer = "";
      last = now;
      if (e.key === "Enter") {
        if (buffer.length >= MIN_LENGTH) {
          e.preventDefault();
          handler.current(toLatinDigits(buffer));
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
