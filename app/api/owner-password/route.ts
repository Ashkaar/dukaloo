import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getViewer, UNLOCK_COOKIE } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { parseBody, serverError } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { recordFailure, tooManyFailures, visitorKey } from "@/lib/rateLimit";
import { isOwnerPassword, ownerVersion, setOwnerPassword, shopSecrets } from "@/lib/secrets";
import { MAX_PASSWORD_LENGTH, MIN_OWNER_PASSWORD_LENGTH } from "@/lib/sections";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/session";
import { cookiePath, shopBase } from "@/lib/tenant";

const schema = z.object({
  current: z.string().max(MAX_PASSWORD_LENGTH).optional(),
  password: z.string().min(MIN_OWNER_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

// POST { current?, password } → sets the owner password. Only the owner's own
// session may do this (not a staff login with the screens unlocked). When a
// password is already set, the current one must be typed too. This device
// stays signed in; every other owner session ends.
export async function POST(request: NextRequest) {
  const m = (await getMessages()).errors;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: m.notLoggedIn }, { status: 401 });
  if (viewer.kind !== "owner") return NextResponse.json({ error: m.ownerOnly }, { status: 403 });
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  const limitKey = visitorKey(request, `owner-password${await shopBase()}`);
  if (tooManyFailures(limitKey)) return NextResponse.json({ error: m.tooMany }, { status: 429 });
  try {
    const before = await shopSecrets(true);
    if (before.owner && !(await isOwnerPassword(data.current ?? ""))) {
      recordFailure(limitKey);
      return NextResponse.json({ error: m.wrongPassword }, { status: 403 });
    }
    await setOwnerPassword(data.password);
    const after = await shopSecrets(true);
    await logActivity("owner", before.owner ? "owner-password-changed" : "owner-password-set");

    const response = NextResponse.json({ ok: true });
    const path = await cookiePath();
    response.cookies.set(SESSION_COOKIE, createSessionToken("owner", ownerVersion(after), after.authSecret), cookieOptions(path, SESSION_SECONDS));
    response.cookies.set(UNLOCK_COOKIE, "", { ...cookieOptions(path, 0), expires: new Date(0) });
    return response;
  } catch (err) {
    return serverError("set the owner password", err);
  }
}
