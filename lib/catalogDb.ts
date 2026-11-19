import "server-only";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  internalBarcode,
  UNITS,
  type Category,
  type Product,
  type ProductInput,
  type ProductOption,
  type ProductSummary,
  type Unit,
  type Variant,
} from "./catalog";
import { getDb, getShopDb } from "./db";
import { categories, products, productVariants, shopSettings } from "./db/schema";

const now = () => Date.now();

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const asUnit = (u: string): Unit => ((UNITS as readonly string[]).includes(u) ? (u as Unit) : "piece");

// ---- Categories -------------------------------------------------------------

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      productCount: sql<number>`(SELECT COUNT(*) FROM products p WHERE p.category_id = ${categories.id} AND p.archived_at IS NULL)`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), sql`${categories.name} COLLATE NOCASE`);
  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}

export async function categoryNameTaken(name: string, exceptId = 0): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(sql`${categories.name} = ${name} COLLATE NOCASE`, ne(categories.id, exceptId)));
  return rows.length > 0;
}

export async function categoryExists(id: number): Promise<boolean> {
  const db = await getDb();
  return (await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id))).length > 0;
}

export async function createCategory(name: string): Promise<Category> {
  const db = await getDb();
  const [row] = await db.insert(categories).values({ name, createdAt: now() }).returning();
  return { id: row.id, name: row.name, productCount: 0 };
}

export async function renameCategory(id: number, name: string): Promise<boolean> {
  const db = await getDb();
  return (await db.update(categories).set({ name }).where(eq(categories.id, id)).returning({ id: categories.id })).length > 0;
}

// Its products stay, without a category.
export async function deleteCategory(id: number): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.update(products).set({ categoryId: null, updatedAt: now() }).where(eq(products.categoryId, id));
    return (await tx.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id })).length > 0;
  });
}

// ---- Products ---------------------------------------------------------------

export interface ProductQuery {
  q: string;
  categoryId: number | null;
  status: "active" | "inactive" | "all";
  limit: number;
  offset: number;
}

// The products list: searched by name, brand, SKU or barcode, a page at a time.
export async function listProducts(query: ProductQuery): Promise<{ items: ProductSummary[]; total: number }> {
  const { client } = await getShopDb();
  const where: string[] = ["p.archived_at IS NULL"];
  const args: (string | number)[] = [];
  if (query.categoryId !== null) {
    where.push("p.category_id = ?");
    args.push(query.categoryId);
  }
  if (query.status !== "all") {
    where.push("p.active = ?");
    args.push(query.status === "active" ? 1 : 0);
  }
  const q = query.q.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(`(p.name LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.archived_at IS NULL
        AND (v.barcode = ? OR v.sku LIKE ? ESCAPE '\\')))`);
    args.push(like, like, q, like);
  }
  const whereSql = where.join(" AND ");
  const [{ rows }, count] = await Promise.all([
    client.execute({
      sql: `SELECT p.id, p.name, p.category_id, p.brand, p.unit, p.active, p.updated_at,
              COUNT(v.id) AS variant_count, MIN(v.price_cents) AS min_price, MAX(v.price_cents) AS max_price,
              CASE WHEN COUNT(v.id) = 1 THEN COALESCE(NULLIF(MAX(v.barcode), ''), MAX(v.sku)) ELSE '' END AS code
            FROM products p
            LEFT JOIN product_variants v ON v.product_id = p.id AND v.archived_at IS NULL
            WHERE ${whereSql}
            GROUP BY p.id
            ORDER BY p.name COLLATE NOCASE, p.id
            LIMIT ? OFFSET ?`,
      args: [...args, query.limit, query.offset],
    }),
    client.execute({ sql: `SELECT COUNT(*) AS n FROM products p WHERE ${whereSql}`, args }),
  ]);
  return {
    total: Number(count.rows[0]?.n ?? 0),
    items: rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      categoryId: r.category_id == null ? null : Number(r.category_id),
      brand: String(r.brand ?? ""),
      unit: asUnit(String(r.unit)),
      active: Number(r.active) === 1,
      variantCount: Number(r.variant_count ?? 0),
      minPriceCents: Number(r.min_price ?? 0),
      maxPriceCents: Number(r.max_price ?? 0),
      code: String(r.code ?? ""),
      updatedAt: Number(r.updated_at),
    })),
  };
}

function toVariant(r: typeof productVariants.$inferSelect): Variant {
  return {
    id: r.id,
    options: parseJson<string[]>(r.options, []),
    sku: r.sku,
    barcode: r.barcode,
    priceCents: r.priceCents,
    costCents: r.costCents,
    lowStockMilli: r.lowStockMilli,
    active: r.active === 1,
  };
}

export async function getProduct(id: number): Promise<Product | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.archivedAt)));
  if (!row) return null;
  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, id), isNull(productVariants.archivedAt)))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.id));
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    brand: row.brand,
    description: row.description,
    unit: asUnit(row.unit),
    options: parseJson<ProductOption[]>(row.options, []),
    variants: variants.map(toVariant),
    active: row.active === 1,
    trackStock: row.trackStock === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// A barcode or SKU already used by another product's live variant.
export type CodeConflict = { kind: "barcode" | "sku"; code: string; productName: string };

async function findConflict(input: ProductInput, productId: number): Promise<CodeConflict | null> {
  const db = await getDb();
  const barcodes = input.variants.map((v) => v.barcode).filter(Boolean);
  const skus = input.variants.map((v) => v.sku.toLocaleLowerCase()).filter(Boolean);
  if (barcodes.length > 0) {
    const [hit] = await db
      .select({ code: productVariants.barcode, productName: products.name })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(inArray(productVariants.barcode, barcodes), isNull(productVariants.archivedAt), ne(productVariants.productId, productId)))
      .limit(1);
    if (hit) return { kind: "barcode", ...hit };
  }
  if (skus.length > 0) {
    const [hit] = await db
      .select({ code: productVariants.sku, productName: products.name })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(inArray(sql`lower(${productVariants.sku})`, skus), isNull(productVariants.archivedAt), ne(productVariants.productId, productId)))
      .limit(1);
    if (hit) return { kind: "sku", ...hit };
  }
  return null;
}

export type SaveResult = { ok: true; id: number } | { ok: false; conflict: CodeConflict } | { ok: false; notFound: true };

// Creates (id = null) or replaces a product with its variants. Variants sent
// with an id are updated; new ones are added; ones left out are archived
// (kept for the records, freeing their barcode and SKU).
export async function saveProduct(input: ProductInput, id: number | null): Promise<SaveResult> {
  const db = await getDb();
  const conflict = await findConflict(input, id ?? 0);
  if (conflict) return { ok: false, conflict };
  const at = now();
  const fields = {
    name: input.name,
    categoryId: input.categoryId,
    brand: input.brand,
    description: input.description,
    unit: input.unit,
    options: JSON.stringify(input.options),
    active: input.active ? 1 : 0,
    trackStock: input.trackStock ? 1 : 0,
    updatedAt: at,
  };

  return db.transaction(async (tx) => {
    let productId: number;
    if (id === null) {
      const [row] = await tx
        .insert(products)
        .values({ ...fields, createdAt: at })
        .returning({ id: products.id });
      productId = row.id;
    } else {
      const updated = await tx
        .update(products)
        .set(fields)
        .where(and(eq(products.id, id), isNull(products.archivedAt)))
        .returning({ id: products.id });
      if (updated.length === 0) return { ok: false as const, notFound: true as const };
      productId = id;
    }

    const existing = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), isNull(productVariants.archivedAt)));
    const existingIds = new Set(existing.map((r) => r.id));
    const keep = new Set(input.variants.map((v) => v.id).filter((v): v is number => v !== undefined && existingIds.has(v)));
    const gone = [...existingIds].filter((v) => !keep.has(v));
    // Archive first, so a barcode moved between variants is free again.
    if (gone.length > 0) {
      await tx.update(productVariants).set({ archivedAt: at, updatedAt: at }).where(inArray(productVariants.id, gone));
    }
    // Clear the codes of kept variants, so codes can swap between them.
    if (keep.size > 0) {
      await tx
        .update(productVariants)
        .set({ barcode: sql`'~' || ${productVariants.id}`, sku: sql`'~' || ${productVariants.id}` })
        .where(inArray(productVariants.id, [...keep]));
    }
    for (const [index, v] of input.variants.entries()) {
      const values = {
        options: JSON.stringify(v.options),
        sku: v.sku,
        barcode: v.barcode,
        priceCents: v.priceCents,
        costCents: v.costCents,
        lowStockMilli: v.lowStockMilli,
        active: v.active ? 1 : 0,
        sortOrder: index,
        updatedAt: at,
      };
      if (v.id !== undefined && keep.has(v.id)) {
        await tx.update(productVariants).set(values).where(eq(productVariants.id, v.id));
      } else {
        await tx.insert(productVariants).values({ ...values, productId, createdAt: at });
      }
    }
    return { ok: true as const, id: productId };
  });
}

export async function archiveProduct(id: number): Promise<boolean> {
  const db = await getDb();
  const at = now();
  return db.transaction(async (tx) => {
    const done = await tx
      .update(products)
      .set({ archivedAt: at, updatedAt: at })
      .where(and(eq(products.id, id), isNull(products.archivedAt)))
      .returning({ id: products.id });
    if (done.length === 0) return false;
    await tx
      .update(productVariants)
      .set({ archivedAt: at, updatedAt: at })
      .where(and(eq(productVariants.productId, id), isNull(productVariants.archivedAt)));
    return true;
  });
}

// ---- Codes ------------------------------------------------------------------

export interface CodeMatch {
  productId: number;
  variantId: number;
  name: string;
  options: string[];
  priceCents: number;
}

// The live variant with this barcode (or, failing that, this SKU).
export async function findByCode(code: string): Promise<CodeMatch | null> {
  const db = await getDb();
  const select = {
    productId: products.id,
    variantId: productVariants.id,
    name: products.name,
    options: productVariants.options,
    priceCents: productVariants.priceCents,
  };
  const base = () =>
    db
      .select(select)
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .$dynamic();
  const live = and(isNull(productVariants.archivedAt), isNull(products.archivedAt));
  let [row] = await base().where(and(eq(productVariants.barcode, code), live)).limit(1);
  if (!row) [row] = await base().where(and(sql`${productVariants.sku} = ${code} COLLATE NOCASE`, live)).limit(1);
  return row ? { ...row, options: parseJson<string[]>(row.options, []) } : null;
}

// A new in-store EAN-13 barcode that no live variant uses yet.
export async function newInternalBarcode(): Promise<string> {
  const db = await getDb();
  for (let attempt = 0; attempt < 50; attempt++) {
    const [row] = await db
      .insert(shopSettings)
      .values({ key: "barcode_counter", value: "1" })
      .onConflictDoUpdate({ target: shopSettings.key, set: { value: sql`CAST(${shopSettings.value} AS INTEGER) + 1` } })
      .returning({ value: shopSettings.value });
    const code = internalBarcode(Number(row.value));
    if (!(await findByCode(code))) return code;
  }
  throw new Error("Couldn't find a free barcode");
}
