import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { UNLOCK_COOKIE, UNLOCK_SECONDS } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { parseBody, requireLogin } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { clearFailures, recordFailure, tooManyFailures, visitorKey } from "@/lib/rateLimit";
import { adminTokenFor, isOwnerPassword, shopSecrets } from "@/lib/secrets";
import { MAX_PASSWORD_LENGTH } from "@/lib/sections";
import { cookieOptions } from "@/lib/session";
import { cookiePath, shopBase } from "@/lib/tenant";

const schema = z.object({ password: z.string().min(1).max(MAX_PASSWORD_LENGTH) });

// POST { password } → opens the owner screens on this device for two hours,
// whoever is signed in. DELETE → locks them again.
export async function POST(request: NextRequest) {
  const { viewer, error: authError } = await requireLogin();
  if (authError) return authError;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  const m = (await getMessages()).errors;
  const limitKey = visitorKey(request, `unlock${await shopBase()}`);
  if (tooManyFailures(limitKey)) return NextResponse.json({ error: m.tooMany }, { status: 429 });
  if (!(await isOwnerPassword(data.password))) {
    recordFailure(limitKey);
    return NextResponse.json({ error: m.wrongPassword }, { status: 403 });
  }
  clearFailures(limitKey);
  await logActivity(viewer.kind === "owner" ? "owner" : viewer.name, "unlock");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(UNLOCK_COOKIE, adminTokenFor(await shopSecrets()), cookieOptions(await cookiePath(), UNLOCK_SECONDS));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(UNLOCK_COOKIE, "", { ...cookieOptions(await cookiePath(), 0), expires: new Date(0) });
  return response;
}
