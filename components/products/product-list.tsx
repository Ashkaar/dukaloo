"use client";

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { PackageIcon, PlusIcon, SearchIcon, TagsIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, ProductSummary } from "@/lib/catalog";
import { getJson } from "@/lib/clientApi";
import { useI18n } from "../i18n-provider";
import { PageBody, PageHeader } from "../page-header";
import { useShop } from "../shop-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useScanner } from "../use-scanner";
import { CameraScannerButton } from "../camera-scanner";
import { CategoriesDialog } from "./categories-dialog";

type Page = { items: ProductSummary[]; total: number };
type Status = "all" | "active" | "inactive";
const ALL = "all";

export function ProductList({ categories: initialCategories, first }: { categories: Category[]; first: Page }) {
  const { t, money } = useI18n();
  const shop = useShop();
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(first.items);
  const [total, setTotal] = useState(first.total);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<Status>("all");
  const [loading, setLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const firstRun = useRef(true);

  const query = (offset: number) => {
    const params = new URLSearchParams({ q, status, offset: String(offset) });
    if (category !== ALL) params.set("category", category);
    return `/api/products?${params}`;
  };

  // Search as you type (a moment after the last key).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await getJson<Page>(query(0));
        if (!cancelled) {
          setItems(page.items);
          setTotal(page.total);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query() reads exactly these
  }, [q, category, status]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const page = await getJson<Page>(query(items.length));
      setItems((list) => [...list, ...page.items]);
      setTotal(page.total);
    } finally {
      setLoading(false);
    }
  };

  // A scan anywhere on the page searches for that code.
  useScanner((code) => {
    setQ(code);
    searchRef.current?.focus();
  });

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const price = (p: ProductSummary) => (p.minPriceCents === p.maxPriceCents ? money(p.minPriceCents) : `${money(p.minPriceCents)} – ${money(p.maxPriceCents)}`);
  const open = (id: number) => router.push(shop.href(`/dashboard/products/${id}`));

  const columns = useMemo(() => {
    const col = createColumnHelper<ProductSummary>();
    return [
      col.accessor("name", {
        header: t.products.colName,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-semibold">{row.original.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[row.original.brand, row.original.variantCount > 1 ? t.products.variants(row.original.variantCount) : ""].filter(Boolean).join(" · ") || " "}
            </p>
          </div>
        ),
      }),
      col.accessor("categoryId", {
        header: t.products.colCategory,
        cell: ({ getValue }) => {
          const id = getValue();
          return <span className="text-muted-foreground">{id === null ? "—" : (categoryName.get(id) ?? "—")}</span>;
        },
      }),
      col.accessor("code", {
        header: t.products.colCode,
        cell: ({ getValue }) => (
          <span dir="ltr" className="tabular font-mono text-xs text-muted-foreground">
            {getValue() || "—"}
          </span>
        ),
      }),
      col.display({
        id: "price",
        header: t.products.colPrice,
        cell: ({ row }) => <span className="tabular font-semibold whitespace-nowrap">{price(row.original)}</span>,
      }),
      col.accessor("active", {
        header: t.products.colStatus,
        cell: ({ getValue }) => <Badge variant={getValue() ? "default" : "neutral"}>{getValue() ? t.products.statusActive : t.products.statusInactive}</Badge>,
      }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- money/price follow the language
  }, [t, categoryName, money]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages its own memoisation
  const table = useReactTable({ data: items, columns, getCoreRowModel: getCoreRowModel(), getRowId: (r) => String(r.id) });
  const filtered = q.trim() !== "" || category !== ALL || status !== "all";

  return (
    <PageBody>
      <PageHeader title={t.products.title} description={t.products.intro}>
        <Button variant="outline" onClick={() => setShowCategories(true)}>
          <TagsIcon />
          {t.products.categories}
        </Button>
        <Button asChild>
          <Link href={shop.href("/dashboard/products/new")}>
            <PlusIcon />
            {t.products.add}
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.products.search}
            aria-label={t.products.search}
            className="ps-9"
            maxLength={100}
          />
        </div>
          <CameraScannerButton onScan={setQ} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-48" aria-label={t.products.colCategory}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.products.allCategories}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="sm:w-36" aria-label={t.products.colStatus}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.products.statusAll}</SelectItem>
              <SelectItem value="active">{t.products.statusActive}</SelectItem>
              <SelectItem value="inactive">{t.products.statusInactive}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <PackageIcon className="size-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">{loading ? t.common.loading : filtered ? t.products.noneFound : t.products.none}</p>
          {!filtered && (
            <Button asChild variant="soft">
              <Link href={shop.href("/dashboard/products/new")}>
                <PlusIcon />
                {t.products.add}
              </Link>
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Computers and tablets: a table. */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[24%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((h) => (
                      <th key={h.id} className="px-4 py-2.5 text-start font-semibold">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => open(row.original.id)}
                    onKeyDown={(e) => e.key === "Enter" && open(row.original.id)}
                    className="cursor-pointer transition-colors hover:bg-highlight focus-visible:bg-highlight focus-visible:outline-none"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="truncate px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Phones: cards. */}
          <Card className="divide-y divide-border md:hidden">
            {items.map((p) => (
              <Link key={p.id} href={shop.href(`/dashboard/products/${p.id}`)} className="flex items-center gap-3 px-4 py-3 active:bg-highlight">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.categoryId !== null ? categoryName.get(p.categoryId) : "", p.variantCount > 1 ? t.products.variants(p.variantCount) : p.code]
                      .filter(Boolean)
                      .join(" · ") || " "}
                  </p>
                </div>
                <div className="text-end">
                  <p className="tabular text-sm font-semibold whitespace-nowrap">{price(p)}</p>
                  {!p.active && <Badge variant="neutral">{t.products.statusInactive}</Badge>}
                </div>
              </Link>
            ))}
          </Card>

          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{t.products.count(total)}</span>
            {items.length < total && (
              <Button variant="outline" onClick={loadMore} disabled={loading}>
                {loading ? t.common.loading : t.products.loadMore}
              </Button>
            )}
          </div>
        </>
      )}

      <CategoriesDialog open={showCategories} onOpenChange={setShowCategories} categories={categories} onChange={setCategories} />
    </PageBody>
  );
}
