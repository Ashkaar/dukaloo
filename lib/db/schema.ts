import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Each shop's own database, as Drizzle sees it (for typed queries).
//
// The tables are created by lib/db/setup.ts (CREATE TABLE IF NOT EXISTS,
// plus ADDED_COLUMNS for later changes), not by a migration tool: there
// is one database per shop, and each is set up on first use. A unit test
// (tests/schema.test.ts) checks that the two descriptions match.
//
// Conventions: money is an integer number of hundredths of the shop's
// currency ("cents"); quantities are integer thousandths ("milli");
// times are integer milliseconds since 1970.

// The shop's signing key and owner password (see lib/secrets.ts).
export const shopSecrets = sqliteTable("shop_secrets", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Settings, one JSON value per key, normalised with defaults when read.
export const shopSettings = sqliteTable("shop_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Staff logins made by the owner. `version` changes with the password or
// when the login is turned off, which ends that user's sessions.
export const staff = sqliteTable(
  "staff",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    // JSON array of section names.
    permissions: text("permissions").notNull().default("[]"),
    active: integer("active").notNull().default(1),
    version: text("version").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("staff_name").on(sql`${t.name} COLLATE NOCASE`)],
);

// The owner's corrections to any text in the app, per language.
export const textOverrides = sqliteTable(
  "text_overrides",
  {
    lang: text("lang").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("text_overrides_lang_key").on(t.lang, t.key)],
);

// Who did what, for the owner (sign-ins, staff and settings changes).
export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: integer("at").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
  },
  (t) => [index("activity_log_at").on(t.at)],
);
