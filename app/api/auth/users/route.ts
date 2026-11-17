import { ok, serverError } from "@/lib/api";
import { hasOwnerPassword } from "@/lib/secrets";
import { listActiveStaffNames } from "@/lib/staffDb";
import { currentShop, multiShop } from "@/lib/tenant";

// GET → who can sign in here: staff names for the sign-in screen, and
// whether the owner can sign in with a password yet. No passwords.
export async function GET() {
  try {
    const shop = await currentShop();
    if (shop && !shop.open) return ok({ staff: [], ownerReady: false });
    const ownerReady = (await hasOwnerPassword()) || (!multiShop() && Boolean(process.env.OWNER_PASSWORD));
    return ok({ staff: await listActiveStaffNames(), ownerReady });
  } catch (error) {
    return serverError("list sign-in names", error);
  }
}
