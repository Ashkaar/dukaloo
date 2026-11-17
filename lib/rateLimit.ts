import "server-only";

// A small per-instance limit on failed password attempts, keyed by shop
// and visitor. It slows down guessing; it isn't a global counter (each
// server instance keeps its own).

const WINDOW_MS = 60_000;
const MAX_FAILURES = 10;
const failures = new Map<string, { start: number; count: number }>();

export function tooManyFailures(key: string, now = Date.now()): boolean {
  const entry = failures.get(key);
  return Boolean(entry && now - entry.start < WINDOW_MS && entry.count >= MAX_FAILURES);
}

export function recordFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) failures.set(key, { start: now, count: 1 });
  else entry.count++;
  if (failures.size > 10_000) {
    for (const [k, v] of failures) if (now - v.start >= WINDOW_MS) failures.delete(k);
  }
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

export function visitorKey(request: Request, scope: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${scope}:${ip}`;
}
