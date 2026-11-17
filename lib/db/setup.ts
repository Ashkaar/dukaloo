import "server-only";
import type { Client } from "@libsql/client";

// Creates a shop's tables on first use. Every statement is safe to run
// again, so setup runs once per database per server instance (lib/db/index.ts).
//
// To change the database later: add new tables to SCHEMA, and new columns
// of existing tables to ADDED_COLUMNS (never edit a CREATE TABLE that has
// shipped). Keep lib/db/schema.ts in step; tests/schema.test.ts checks it.
//
// A new shop starts EMPTY: no starter categories, units or sample data.

export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS shop_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS shop_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    version TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS staff_name ON staff (name COLLATE NOCASE)",
  `CREATE TABLE IF NOT EXISTS text_overrides (
    lang TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS text_overrides_lang_key ON text_overrides (lang, key)",
  `CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
  )`,
  "CREATE INDEX IF NOT EXISTS activity_log_at ON activity_log (at)",
];

// Columns added to tables after they first shipped: [table, column, definition].
export const ADDED_COLUMNS: [string, string, string][] = [];

async function addMissingColumns(client: Client): Promise<void> {
  const tables = [...new Set(ADDED_COLUMNS.map(([table]) => table))];
  for (const table of tables) {
    const { rows } = await client.execute(`PRAGMA table_info(${table})`);
    const have = new Set(rows.map((r) => String(r.name)));
    for (const [t, column, definition] of ADDED_COLUMNS) {
      if (t === table && !have.has(column)) {
        try {
          await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } catch (err) {
          // Another server instance may have added it a moment ago.
          if (!String(err).includes("duplicate column")) throw err;
        }
      }
    }
  }
}

export async function setUp(client: Client): Promise<void> {
  await client.batch(SCHEMA, "write");
  await addMissingColumns(client);
}
