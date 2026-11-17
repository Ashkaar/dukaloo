import "server-only";
import { createHmac } from "crypto";
import { safeEqual } from "./passwords";

// Signed login sessions, in the httpOnly `dukaloo_session` cookie, scoped
// to the shop's address. The cookie holds
// `v1.<subject>.<version>.<expires>.<signature>`, where subject is "owner"
// or a staff id, and the signature is HMAC-SHA256 with the shop's own key
// (lib/secrets.ts). The version ends sessions when a password changes.

export const SESSION_COOKIE = "dukaloo_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionToken {
  subject: "owner" | number;
  version: string;
}

const sign = (payload: string, secret: string) => createHmac("sha256", `session:${secret}`).update(payload).digest("hex");

export function createSessionToken(subject: "owner" | number, version: string, secret: string, nowMs = Date.now()): string {
  const expires = Math.floor(nowMs / 1000) + SESSION_SECONDS;
  const payload = `v1.${subject}.${version}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

// Checks the cookie's signature and expiry; null when it isn't a valid login.
export function readSessionToken(token: string | undefined, secret: string, nowMs = Date.now()): SessionToken | null {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return null;
  const [, subject, version, expires, signature] = parts;
  if (!(Number(expires) > nowMs / 1000)) return null;
  if (!safeEqual(signature, sign(parts.slice(0, 4).join("."), secret))) return null;
  if (subject === "owner") return { subject, version };
  const id = Number(subject);
  return Number.isInteger(id) && id > 0 ? { subject: id, version } : null;
}

export function cookieOptions(path: string, maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge, path };
}
