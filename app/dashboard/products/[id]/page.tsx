import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/products/product-editor";
import { parseId } from "@/lib/api";
import { getProduct, listCategories } from "@/lib/catalogDb";
import { requireSectionPage } from "@/lib/pageAccess";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSectionPage("products");
  const id = parseId((await params).id);
  const product = id ? await getProduct(id) : null;
  if (!product) notFound();
  // Keyed by the product's last change, so a save starts the form afresh.
  return <ProductEditor key={`${product.id}-${product.updatedAt}`} product={product} categories={await listCategories()} />;
}
