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

// ---- Catalogue ----------------------------------------------------------

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("categories_name").on(sql`${t.name} COLLATE NOCASE`)],
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    categoryId: integer("category_id"),
    brand: text("brand").notNull().default(""),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull().default("piece"),
    // JSON: [{ name, values: [...] }]
    options: text("options").notNull().default("[]"),
    active: integer("active").notNull().default(1),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("products_category").on(t.categoryId), index("products_name").on(sql`${t.name} COLLATE NOCASE`)],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull(),
    // JSON: one value per product option.
    options: text("options").notNull().default("[]"),
    sku: text("sku").notNull().default(""),
    barcode: text("barcode").notNull().default(""),
    priceCents: integer("price_cents").notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0),
    lowStockMilli: integer("low_stock_milli").notNull().default(0),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("product_variants_product").on(t.productId),
    uniqueIndex("product_variants_barcode").on(t.barcode).where(sql`${t.barcode} <> '' AND ${t.archivedAt} IS NULL`),
    uniqueIndex("product_variants_sku").on(sql`${t.sku} COLLATE NOCASE`).where(sql`${t.sku} <> '' AND ${t.archivedAt} IS NULL`),
  ],
);
