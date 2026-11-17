import { ProductList } from "@/components/products/product-list";
import { listCategories, listProducts } from "@/lib/catalogDb";
import { requireSectionPage } from "@/lib/pageAccess";

export default async function ProductsPage() {
  await requireSectionPage("products");
  const [categories, first] = await Promise.all([
    listCategories(),
    listProducts({ q: "", categoryId: null, status: "all", limit: 50, offset: 0 }),
  ]);
  return <ProductList categories={categories} first={first} />;
}
