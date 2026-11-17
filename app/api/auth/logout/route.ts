import { NextResponse } from "next/server";
import { UNLOCK_COOKIE } from "@/lib/access";
import { cookieOptions, SESSION_COOKIE } from "@/lib/session";
import { cookiePath } from "@/lib/tenant";

// POST → signs out on this device.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  const path = await cookiePath();
  for (const name of [SESSION_COOKIE, UNLOCK_COOKIE]) {
    response.cookies.set(name, "", { ...cookieOptions(path, 0), expires: new Date(0) });
  }
  return response;
}
