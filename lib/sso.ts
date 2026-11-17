import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Arriving from Ariloo already signed in. When a shop's owner presses
// "Open Dukaloo" in their Ariloo account, Ariloo sends them to
// /<shop>/api/auth/sso?token=v1.<shop>.<expires, seconds>.<hmac>, where hmac
// is HMAC-SHA256 hex of "sso:<shop>.<expires>" with DUKALOO_SSO_SECRET (the
// same value in both apps). It is good for one minute and only for the
// shop it names.

export const SSO_MAX_SECONDS = 60;

export function signSsoToken(slug: string, expires: number, secret: string): string {
  return `v1.${slug}.${expires}.${createHmac("sha256", secret).update(`sso:${slug}.${expires}`).digest("hex")}`;
}

export function checkSsoToken(token: string | null, slug: string, secret = process.env.DUKALOO_SSO_SECRET, nowMs = Date.now()): boolean {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || parts[1] !== slug || !/^\d{1,12}$/.test(parts[2])) return false;
  const expires = Number(parts[2]);
  const now = nowMs / 1000;
  // Not expired, and not issued for longer than a minute (a few seconds of
  // clock difference between the two servers are allowed).
  if (!(expires > now) || expires > now + SSO_MAX_SECONDS + 5) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`sso:${slug}.${parts[2]}`).digest("hex"));
  const actual = Buffer.from(parts[3]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
