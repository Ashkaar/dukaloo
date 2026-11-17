import "server-only";
import { getDb } from "./db";
import { activityLog } from "./db/schema";

// Notes who did what (sign-ins, staff and settings changes) for the owner.
// Never fails the request it belongs to.
export async function logActivity(actor: string, action: string, detail = ""): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(activityLog).values({ at: Date.now(), actor: actor.slice(0, 60), action: action.slice(0, 60), detail: detail.slice(0, 300) });
  } catch (err) {
    console.error("Couldn't record activity:", err);
  }
}
