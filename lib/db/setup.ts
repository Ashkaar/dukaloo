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

  // ---- Catalogue (products, variants, categories) ----
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS categories_name ON categories (name COLLATE NOCASE)",
  // A product is never deleted once made, only archived, so sales and stock
  // records can always name what was sold.
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER,
    brand TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'piece',
    options TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    archived_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS products_category ON products (category_id)",
  "CREATE INDEX IF NOT EXISTS products_name ON products (name COLLATE NOCASE)",
  `CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    sku TEXT NOT NULL DEFAULT '',
    barcode TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL DEFAULT 0,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    low_stock_milli INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS product_variants_product ON product_variants (product_id)",
  // A barcode or SKU belongs to one live variant at a time.
  "CREATE UNIQUE INDEX IF NOT EXISTS product_variants_barcode ON product_variants (barcode) WHERE barcode <> '' AND archived_at IS NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku ON product_variants (sku COLLATE NOCASE) WHERE sku <> '' AND archived_at IS NULL",

  // ---- Stock: every change is a row; the level is their sum ----
  // kind: opening | adjust | count | sale | void | return | purchase
  `CREATE TABLE IF NOT EXISTS stock_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id INTEGER NOT NULL,
    qty_milli INTEGER NOT NULL,
    kind TEXT NOT NULL,
    ref_id INTEGER,
    note TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS stock_moves_variant ON stock_moves (variant_id)",
  "CREATE INDEX IF NOT EXISTS stock_moves_at ON stock_moves (at)",

  // ---- Sales ----
  `CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    staff_id INTEGER,
    staff_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'done',
    subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    tax_name TEXT NOT NULL DEFAULT '',
    tax_rate_bp INTEGER NOT NULL DEFAULT 0,
    tax_inclusive INTEGER NOT NULL DEFAULT 1,
    total_cents INTEGER NOT NULL,
    paid_cents INTEGER NOT NULL,
    change_cents INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    voided_at INTEGER,
    voided_by TEXT NOT NULL DEFAULT ''
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS sales_client_id ON sales (client_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS sales_number ON sales (number)",
  "CREATE INDEX IF NOT EXISTS sales_at ON sales (at)",
  `CREATE TABLE IF NOT EXISTS sale_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    variant_label TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'piece',
    qty_milli INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    cost_cents INTEGER NOT NULL DEFAULT 0
  )`,
  "CREATE INDEX IF NOT EXISTS sale_lines_sale ON sale_lines (sale_id)",
  "CREATE INDEX IF NOT EXISTS sale_lines_variant ON sale_lines (variant_id)",
  `CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    method TEXT NOT NULL,
    amount_cents INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS sale_payments_sale ON sale_payments (sale_id)",

  // ---- Returns: items given back from a sale, and the money refunded ----
  `CREATE TABLE IF NOT EXISTS sale_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    staff_name TEXT NOT NULL DEFAULT '',
    refund_cents INTEGER NOT NULL,
    method TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS sale_returns_client_id ON sale_returns (client_id)",
  "CREATE INDEX IF NOT EXISTS sale_returns_sale ON sale_returns (sale_id)",
  "CREATE INDEX IF NOT EXISTS sale_returns_at ON sale_returns (at)",
  `CREATE TABLE IF NOT EXISTS sale_return_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    sale_line_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    qty_milli INTEGER NOT NULL,
    refund_cents INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS sale_return_lines_return ON sale_return_lines (return_id)",
  "CREATE INDEX IF NOT EXISTS sale_return_lines_line ON sale_return_lines (sale_line_id)",

  // ---- Customers ----
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    archived_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS customers_name ON customers (name COLLATE NOCASE)",
  "CREATE UNIQUE INDEX IF NOT EXISTS customers_phone ON customers (phone) WHERE phone <> '' AND archived_at IS NULL",

  // ---- Suppliers and purchases (stock coming in) ----
  `CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    archived_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS suppliers_name ON suppliers (name COLLATE NOCASE)",
  `CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    supplier_id INTEGER,
    supplier_name TEXT NOT NULL DEFAULT '',
    reference TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    total_cents INTEGER NOT NULL,
    staff_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'received',
    cancelled_at INTEGER,
    cancelled_by TEXT NOT NULL DEFAULT ''
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS purchases_client_id ON purchases (client_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS purchases_number ON purchases (number)",
  "CREATE INDEX IF NOT EXISTS purchases_at ON purchases (at)",
  "CREATE INDEX IF NOT EXISTS purchases_supplier ON purchases (supplier_id)",
  `CREATE TABLE IF NOT EXISTS purchase_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    variant_label TEXT NOT NULL DEFAULT '',
    qty_milli INTEGER NOT NULL,
    unit_cost_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS purchase_lines_purchase ON purchase_lines (purchase_id)",
  "CREATE INDEX IF NOT EXISTS purchase_lines_variant ON purchase_lines (variant_id)",
];

// Columns added to tables after they first shipped: [table, column, definition].
export const ADDED_COLUMNS: [string, string, string][] = [
  // Count this product's stock (off for services and things not counted).
  ["products", "track_stock", "INTEGER NOT NULL DEFAULT 1"],
  // The customer a sale was for (and their name then, for the records).
  ["sales", "customer_id", "INTEGER"],
  ["sales", "customer_name", "TEXT NOT NULL DEFAULT ''"],
];

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
  // Indexes on added columns, once the columns exist.
  await client.execute("CREATE INDEX IF NOT EXISTS sales_customer ON sales (customer_id)");
}
