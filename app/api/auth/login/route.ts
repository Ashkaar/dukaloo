import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { UNLOCK_COOKIE } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { parseBody } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { sectionsInPlan } from "@/lib/plans";
import { clearFailures, recordFailure, tooManyFailures, visitorKey } from "@/lib/rateLimit";
import { isOwnerPassword, ownerVersion, shopSecrets } from "@/lib/secrets";
import { homeFor, MAX_PASSWORD_LENGTH, SECTIONS, type Section } from "@/lib/sections";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/session";
import { checkStaffLogin } from "@/lib/staffDb";
import { cookiePath, currentShop, multiShop, shopBase } from "@/lib/tenant";

const schema = z.object({
  user: z.union([z.literal("owner"), z.number().int().positive()]),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

// POST { user: "owner" | staffId, password } → signs in and returns where to go first.
export async function POST(request: NextRequest) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  const m = (await getMessages()).errors;
  const limitKey = visitorKey(request, `login${await shopBase()}`);
  if (tooManyFailures(limitKey)) return NextResponse.json({ error: m.tooMany }, { status: 429 });

  let token: string | null = null;
  let sections: Section[] = [];
  let actor = "";
  try {
    const shop = await currentShop();
    if (!shop || shop.open) {
      const secrets = await shopSecrets();
      if (data.user === "owner") {
        if (await isOwnerPassword(data.password)) {
          const fresh = await shopSecrets();
          token = createSessionToken("owner", ownerVersion(fresh), fresh.authSecret);
          sections = [...SECTIONS];
          actor = "owner";
        }
      } else {
        const found = await checkStaffLogin(data.user, data.password);
        if (found) {
          token = createSessionToken(found.user.id, found.version, secrets.authSecret);
          sections = found.user.permissions;
          actor = found.user.name;
        }
      }
      const plan = sectionsInPlan(shop?.plan ?? null, !multiShop());
      sections = sections.filter((s) => plan.includes(s));
    }
  } catch (err) {
    console.error("Failed to sign in:", err);
    return NextResponse.json({ error: m.server }, { status: 500 });
  }

  if (!token) {
    recordFailure(limitKey);
    return NextResponse.json({ error: m.wrongPassword }, { status: 401 });
  }
  clearFailures(limitKey);
  await logActivity(actor, "sign-in");

  // `home` is a path inside the app; the page adds the shop's address.
  const response = NextResponse.json({ home: homeFor(sections) });
  const path = await cookiePath();
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(path, SESSION_SECONDS));
  // A new sign-in starts locked, so the previous person's unlock doesn't carry over.
  response.cookies.set(UNLOCK_COOKIE, "", { ...cookieOptions(path, 0), expires: new Date(0) });
  return response;
}
