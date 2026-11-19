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
    // Added later (ADDED_COLUMNS).
    trackStock: integer("track_stock").notNull().default(1),
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

// ---- Stock ----------------------------------------------------------------

export const stockMoves = sqliteTable(
  "stock_moves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    variantId: integer("variant_id").notNull(),
    qtyMilli: integer("qty_milli").notNull(),
    kind: text("kind").notNull(),
    refId: integer("ref_id"),
    note: text("note").notNull().default(""),
    actor: text("actor").notNull().default(""),
    at: integer("at").notNull(),
  },
  (t) => [index("stock_moves_variant").on(t.variantId), index("stock_moves_at").on(t.at)],
);

// ---- Sales ----------------------------------------------------------------

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: integer("number").notNull(),
    clientId: text("client_id").notNull(),
    at: integer("at").notNull(),
    staffId: integer("staff_id"),
    staffName: text("staff_name").notNull().default(""),
    status: text("status").notNull().default("done"),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    taxName: text("tax_name").notNull().default(""),
    taxRateBp: integer("tax_rate_bp").notNull().default(0),
    taxInclusive: integer("tax_inclusive").notNull().default(1),
    totalCents: integer("total_cents").notNull(),
    paidCents: integer("paid_cents").notNull(),
    changeCents: integer("change_cents").notNull().default(0),
    note: text("note").notNull().default(""),
    voidedAt: integer("voided_at"),
    voidedBy: text("voided_by").notNull().default(""),
    // Added later (ADDED_COLUMNS).
    customerId: integer("customer_id"),
    customerName: text("customer_name").notNull().default(""),
  },
  (t) => [uniqueIndex("sales_client_id").on(t.clientId), uniqueIndex("sales_number").on(t.number), index("sales_at").on(t.at)],
);

export const saleLines = sqliteTable(
  "sale_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id").notNull(),
    variantId: integer("variant_id").notNull(),
    productId: integer("product_id").notNull(),
    name: text("name").notNull(),
    variantLabel: text("variant_label").notNull().default(""),
    unit: text("unit").notNull().default("piece"),
    qtyMilli: integer("qty_milli").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    costCents: integer("cost_cents").notNull().default(0),
  },
  (t) => [index("sale_lines_sale").on(t.saleId), index("sale_lines_variant").on(t.variantId)],
);

export const salePayments = sqliteTable(
  "sale_payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id").notNull(),
    method: text("method").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [index("sale_payments_sale").on(t.saleId)],
);

// ---- Returns --------------------------------------------------------------

export const saleReturns = sqliteTable(
  "sale_returns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id").notNull(),
    clientId: text("client_id").notNull(),
    at: integer("at").notNull(),
    staffName: text("staff_name").notNull().default(""),
    refundCents: integer("refund_cents").notNull(),
    method: text("method").notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [uniqueIndex("sale_returns_client_id").on(t.clientId), index("sale_returns_sale").on(t.saleId), index("sale_returns_at").on(t.at)],
);

export const saleReturnLines = sqliteTable(
  "sale_return_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    returnId: integer("return_id").notNull(),
    saleLineId: integer("sale_line_id").notNull(),
    variantId: integer("variant_id").notNull(),
    qtyMilli: integer("qty_milli").notNull(),
    refundCents: integer("refund_cents").notNull(),
  },
  (t) => [index("sale_return_lines_return").on(t.returnId), index("sale_return_lines_line").on(t.saleLineId)],
);

// ---- Customers ------------------------------------------------------------

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    address: text("address").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (t) => [index("customers_name").on(sql`${t.name} COLLATE NOCASE`), uniqueIndex("customers_phone").on(t.phone).where(sql`${t.phone} <> '' AND ${t.archivedAt} IS NULL`)],
);

// ---- Suppliers and purchases ---------------------------------------------

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    address: text("address").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (t) => [index("suppliers_name").on(sql`${t.name} COLLATE NOCASE`)],
);

export const purchases = sqliteTable(
  "purchases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: integer("number").notNull(),
    clientId: text("client_id").notNull(),
    at: integer("at").notNull(),
    supplierId: integer("supplier_id"),
    supplierName: text("supplier_name").notNull().default(""),
    reference: text("reference").notNull().default(""),
    note: text("note").notNull().default(""),
    totalCents: integer("total_cents").notNull(),
    staffName: text("staff_name").notNull().default(""),
    status: text("status").notNull().default("received"),
    cancelledAt: integer("cancelled_at"),
    cancelledBy: text("cancelled_by").notNull().default(""),
  },
  (t) => [
    uniqueIndex("purchases_client_id").on(t.clientId),
    uniqueIndex("purchases_number").on(t.number),
    index("purchases_at").on(t.at),
    index("purchases_supplier").on(t.supplierId),
  ],
);

export const purchaseLines = sqliteTable(
  "purchase_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseId: integer("purchase_id").notNull(),
    variantId: integer("variant_id").notNull(),
    productId: integer("product_id").notNull(),
    name: text("name").notNull(),
    variantLabel: text("variant_label").notNull().default(""),
    qtyMilli: integer("qty_milli").notNull(),
    unitCostCents: integer("unit_cost_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (t) => [index("purchase_lines_purchase").on(t.purchaseId), index("purchase_lines_variant").on(t.variantId)],
);

// ---- Expenses -------------------------------------------------------------

export const expenseTypes = sqliteTable(
  "expense_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("expense_types_name").on(sql`${t.name} COLLATE NOCASE`)],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: text("client_id").notNull(),
    day: text("day").notNull(),
    typeId: integer("type_id"),
    amountCents: integer("amount_cents").notNull(),
    method: text("method").notNull().default("cash"),
    note: text("note").notNull().default(""),
    staffName: text("staff_name").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [uniqueIndex("expenses_client_id").on(t.clientId), index("expenses_day").on(t.day)],
);
