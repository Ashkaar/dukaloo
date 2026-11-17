import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { safeEqual } from "./passwords";
import { sectionsInPlan } from "./plans";
import { adminTokenFor, ownerVersion, shopSecrets } from "./secrets";
import { OWNER_SECTIONS, SECTIONS, type Section, type Viewer } from "./sections";
import { readSessionToken, SESSION_COOKIE } from "./session";
import { getStaffSession } from "./staffDb";
import { currentShop, multiShop, ShopError } from "./tenant";

// Who is signed in and what they may open, worked out once per request.
//
// - Owner: every section in the shop's plan.
// - Staff: the sections ticked for them on the Staff screen (never the
//   owner-only ones), within the plan.
// Entering the owner password on a device (the dukaloo_unlock cookie)
// opens everything there for two hours, whoever is signed in.
//
// The plan is applied HERE and nowhere else, so the navigation, the pages
// and the API all follow it.

export const UNLOCK_COOKIE = "dukaloo_unlock";
export const UNLOCK_SECONDS = 2 * 60 * 60;

export const getViewer = cache(async (): Promise<Viewer | null> => {
  // A closed shop (or an address with no shop) has no one signed in.
  let plan: readonly Section[];
  try {
    const shop = await currentShop();
    if (shop && !shop.open) return null;
    plan = sectionsInPlan(shop?.plan ?? null, !multiShop());
  } catch (err) {
    if (err instanceof ShopError) return null;
    throw err;
  }
  let secrets = await shopSecrets();
  const store = await cookies();
  const session = readSessionToken(store.get(SESSION_COOKIE)?.value, secrets.authSecret);
  if (!session) return null;

  // An owner login that doesn't match may belong to a password changed a
  // moment ago on another server instance: look again in the database.
  if (session.subject === "owner" && session.version !== ownerVersion(secrets)) {
    secrets = await shopSecrets(true);
    if (session.version !== ownerVersion(secrets)) return null;
  }

  const unlockCookie = store.get(UNLOCK_COOKIE)?.value;
  const unlocked = Boolean(secrets.owner && unlockCookie && safeEqual(unlockCookie, adminTokenFor(secrets)));
  const inPlan = (list: readonly Section[]) => SECTIONS.filter((s) => list.includes(s) && plan.includes(s));

  if (session.subject === "owner") {
    return { kind: "owner", name: "", staffId: null, sections: inPlan(SECTIONS), isOwner: true, unlocked: false };
  }

  const user = await getStaffSession(session.subject, session.version);
  if (!user) return null;
  const own = user.permissions.filter((s) => !OWNER_SECTIONS.includes(s));
  return {
    kind: "staff",
    name: user.name,
    staffId: user.id,
    sections: inPlan(unlocked ? SECTIONS : own),
    isOwner: unlocked,
    unlocked,
  };
});

export async function canOpen(section: Section): Promise<boolean> {
  return Boolean((await getViewer())?.sections.includes(section));
}
