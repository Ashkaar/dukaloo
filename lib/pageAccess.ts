import "server-only";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "./access";
import { homeFor, OWNER_SECTIONS, type Section, type Viewer } from "./sections";
import { currentShop, shopPath, ShopError } from "./tenant";

// Page guards: every page checks for itself, like every API route.

// False when the root layout is showing a notice instead of the app (no
// such shop, closed, or no database yet): pages then render nothing and
// never touch the database.
export async function shopUsable(): Promise<boolean> {
  try {
    const shop = await currentShop();
    return !shop || (shop.open && Boolean(shop.dbUrl));
  } catch (err) {
    if (err instanceof ShopError) return false;
    throw err;
  }
}

export async function requireViewer(): Promise<Viewer> {
  if (!(await shopUsable())) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(await shopPath("/login"));
  return viewer;
}

// The page for `section`. Returns "locked" when it's an owner screen that a
// staff login could open after typing the owner password on this device
// (the page then shows the unlock form); sends anyone else who can't open
// it to their own first section.
export async function requireSectionPage(section: Section): Promise<{ viewer: Viewer; locked: boolean }> {
  const viewer = await requireViewer();
  if (viewer.sections.includes(section)) return { viewer, locked: false };
  if (OWNER_SECTIONS.includes(section) && viewer.kind === "staff") return { viewer, locked: true };
  redirect(await shopPath(homeFor(viewer.sections)));
}
