"use client";

import { CameraIcon, CameraOffIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toLatinDigits } from "@/lib/format";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

// Reads barcodes with the device's camera. Uses the browser's own
// BarcodeDetector where there is one (Chrome on Android and desktop), and
// otherwise the open-source ZXing reader, loaded only when needed.
//
// `continuous`: keep the camera open and report each new code (the till);
// otherwise close after the first code (a barcode field, a search).

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => Detector;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code"];

// A short beep, so the cashier hears each scan.
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1400;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => ctx.close();
  } catch {
    // No sound: never mind.
  }
}

export function CameraScannerButton({ onScan, continuous = false, label, className }: { onScan: (code: string) => void; continuous?: boolean; label?: string; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="icon" className={className} onClick={() => setOpen(true)} aria-label={label ?? t.camera.scan} title={label ?? t.camera.scan}>
        <CameraIcon />
      </Button>
      {open && (
        <CameraScanner
          continuous={continuous}
          onClose={() => setOpen(false)}
          onScan={(code) => {
            onScan(code);
            if (!continuous) setOpen(false);
          }}
        />
      )}
    </>
  );
}

function CameraScanner({ onScan, onClose, continuous }: { onScan: (code: string) => void; onClose: () => void; continuous: boolean }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [last, setLast] = useState("");
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let stopZxing: (() => void) | null = null;
    let lastCode = "";
    let lastAt = 0;

    const found = (raw: string) => {
      const code = toLatinDigits(raw.trim());
      const now = Date.now();
      // The same code held in front of the camera counts once every 2 seconds.
      if (!code || (code === lastCode && now - lastAt < 2000)) return;
      lastCode = code;
      lastAt = now;
      beep();
      setLast(code);
      handler.current(code);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem(t.camera.unsupported);
        return;
      }
      const el = video.current!;
      if (window.BarcodeDetector) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (stopped) return;
          el.srcObject = stream;
          await el.play();
          const detector = new window.BarcodeDetector({ formats: FORMATS });
          const tick = async () => {
            if (stopped) return;
            try {
              if (el.readyState >= 2) for (const c of await detector.detect(el)) found(c.rawValue);
            } catch {
              // A frame that couldn't be read.
            }
            setTimeout(tick, 150);
          };
          tick();
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "NotAllowedError") {
            setProblem(t.camera.denied);
            return;
          }
          // Fall through to ZXing.
        }
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stopped) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, el, (result) => {
          if (result) found(result.getText());
        });
        if (stopped) controls.stop();
        else stopZxing = () => controls.stop();
      } catch (err) {
        setProblem(err instanceof DOMException && err.name === "NotAllowedError" ? t.camera.denied : t.camera.unsupported);
      }
    };
    start();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((tr) => tr.stop());
      stopZxing?.();
    };
  }, [t]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.camera.title}</DialogTitle>
          <DialogDescription>{continuous ? t.camera.introContinuous : t.camera.intro}</DialogDescription>
        </DialogHeader>
        {problem ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
            <CameraOffIcon className="size-8" />
            {problem}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-surface-950">
            <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
            {/* A guide for where to hold the barcode. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-accent-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>
        )}
        {last && (
          <p className="text-center text-sm">
            {t.camera.last} <span className="font-mono font-semibold" dir="ltr">{last}</span>
          </p>
        )}
        <Button variant="outline" onClick={onClose}>
          {t.common.close}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
