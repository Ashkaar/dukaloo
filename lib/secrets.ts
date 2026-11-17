import "server-only";
import { createHmac, randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import { getShopDb } from "./db";
import { shopSecrets as secretsTable } from "./db/schema";
import { hashPassword, verifyPassword } from "./passwords";
import { multiShop } from "./tenant";

// Each shop's secrets, kept in its own database (table shop_secrets):
// - auth_secret: the key that signs its logins, made on first use;
// - owner_password: set by the owner, who first arrives signed in from
//   their Ariloo account (or, in single-shop mode, OWNER_PASSWORD until
//   one is chosen in the app).

export interface Secrets {
  authSecret: string;
  // The owner password as stored ("scrypt$…", or plain OWNER_PASSWORD), or null.
  owner: string | null;
}

const TTL_MS = 30_000;
const cached = new Map<string, { at: number; secrets: Secrets }>();

// The copy kept in memory can be up to 30 seconds old, and every server
// instance has its own. A check that fails (a session or a password that
// doesn't match) is tried once more with `fresh`, which reads the database.
export async function shopSecrets(fresh = false): Promise<Secrets> {
  const { db, key } = await getShopDb();
  const hit = cached.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.secrets;

  const read = async () => new Map((await db.select().from(secretsTable)).map((r) => [r.key, r.value]));
  let stored = await read();
  if (!stored.get("auth_secret")) {
    // First visit. If two requests race, the first one's key stays.
    await db.insert(secretsTable).values({ key: "auth_secret", value: randomBytes(32).toString("hex") }).onConflictDoNothing();
    stored = await read();
  }
  const secrets: Secrets = {
    authSecret: stored.get("auth_secret")!,
    owner: stored.get("owner_password") || (multiShop() ? null : process.env.OWNER_PASSWORD || null),
  };
  cached.set(key, { at: Date.now(), secrets });
  return secrets;
}

// True when `candidate` is the shop's owner password. Always false while
// none is set, rather than falling back to a default.
export async function isOwnerPassword(candidate: unknown): Promise<boolean> {
  if (typeof candidate !== "string" || !candidate) return false;
  if (await verifyPassword(candidate, (await shopSecrets()).owner)) return true;
  // Perhaps it was changed a moment ago on another server instance.
  return verifyPassword(candidate, (await shopSecrets(true)).owner);
}

export async function setOwnerPassword(password: string): Promise<void> {
  const { db, key } = await getShopDb();
  const value = await hashPassword(password);
  await db
    .insert(secretsTable)
    .values({ key: "owner_password", value })
    .onConflictDoUpdate({ target: secretsTable.key, set: { value: sql`excluded.value` } });
  cached.delete(key);
}

export async function hasOwnerPassword(): Promise<boolean> {
  const { db } = await getShopDb();
  const rows = await db.select().from(secretsTable).where(eq(secretsTable.key, "owner_password"));
  return rows.length > 0;
}

// The owner's session version follows the owner password, so changing it
// signs the owner out everywhere.
export function ownerVersion(secrets: Secrets): string {
  return createHmac("sha256", secrets.authSecret).update(`owner:${secrets.owner ?? ""}`).digest("hex").slice(0, 12);
}

// The admin-unlock cookie holds this derived token rather than the password.
export function adminTokenFor(secrets: Secrets): string {
  return createHmac("sha256", secrets.authSecret).update(`admin:${secrets.owner ?? ""}`).digest("hex");
}
