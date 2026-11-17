import { createClient } from "@libsql/client";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { setUp } from "@/lib/db/setup";

// The tables are created by lib/db/setup.ts and queried through Drizzle's
// lib/db/schema.ts: the two must describe the same columns.
describe("database schema", () => {
  it("setup creates every table and column Drizzle knows, and nothing else", async () => {
    const client = createClient({ url: ":memory:" });
    await setUp(client);
    await setUp(client); // safe to run twice
    for (const table of Object.values(schema) as SQLiteTable[]) {
      const config = getTableConfig(table);
      const { rows } = await client.execute(`PRAGMA table_info(${config.name})`);
      const actual = rows.map((r) => String(r.name)).sort();
      const expected = config.columns.map((c) => c.name).sort();
      expect(actual, config.name).toEqual(expected);
      for (const column of config.columns) {
        const row = rows.find((r) => r.name === column.name)!;
        expect(Number(row.notnull) === 1 || Number(row.pk) === 1, `${config.name}.${column.name} not null`).toBe(column.notNull);
      }
    }
  });
});
