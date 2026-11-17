import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { UNLOCK_COOKIE } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { ownerVersion, shopSecrets } from "@/lib/secrets";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/session";
import { checkSsoToken } from "@/lib/sso";
import { cookiePath, currentShop, shopPath } from "@/lib/tenant";

// GET ?token=… → signs the shop's owner in, coming from their Ariloo
// account ("Open Dukaloo", lib/sso.ts), and sends them to the dashboard, or
// to choose an owner password if the shop has none yet.
export async function GET(request: NextRequest) {
  const to = async (path: string) => {
    const response = NextResponse.redirect(new URL(await shopPath(path), request.url));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  try {
    const shop = await currentShop();
    if (!shop || !shop.open || !checkSsoToken(request.nextUrl.searchParams.get("token"), shop.slug)) return to("/login");
    const secrets = await shopSecrets(true);
    const response = await to(secrets.owner ? "/dashboard" : "/owner-password");
    const path = await cookiePath();
    response.cookies.set(SESSION_COOKIE, createSessionToken("owner", ownerVersion(secrets), secrets.authSecret), cookieOptions(path, SESSION_SECONDS));
    response.cookies.set(UNLOCK_COOKIE, "", { ...cookieOptions(path, 0), expires: new Date(0) });
    await logActivity("owner", "sign-in-ariloo");
    return response;
  } catch (error) {
    console.error("Failed to sign in from Ariloo:", error);
    return to("/login");
  }
}
