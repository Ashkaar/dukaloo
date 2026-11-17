import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { shopDatabase, type Shop } from "../tenant";
import * as schema from "./schema";
import { setUp } from "./setup";

export type Db = LibSQLDatabase<typeof schema> & { $client: Client };

// One client per database, kept for the life of the server instance.
const clients = new Map<string, { client: Client; db: Db }>();
// Table setup runs once per database per server instance.
const ready = new Map<string, Promise<void>>();

// The database of the shop this request is for (see lib/tenant.ts), set up
// on first use, with a key that is the same for every request to it.
export async function getShopDb(): Promise<{ db: Db; client: Client; key: string; shop: Shop | null }> {
  const { url, authToken, shop } = await shopDatabase();
  if (!url) throw new Error("No database configured. Set DB_TURSO_DATABASE_URL (single-shop mode) or the Ariloo variables.");
  let entry = clients.get(url);
  if (!entry) {
    const client = createClient({ url, authToken });
    entry = { client, db: drizzle(client, { schema }) as Db };
    clients.set(url, entry);
  }
  let setup = ready.get(url);
  if (!setup) {
    setup = setUp(entry.client).catch((err) => {
      ready.delete(url);
      throw err;
    });
    ready.set(url, setup);
  }
  await setup;
  return { ...entry, key: url, shop };
}

export async function getDb(): Promise<Db> {
  return (await getShopDb()).db;
}

export { schema };
