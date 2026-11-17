import { ProductEditor } from "@/components/products/product-editor";
import { listCategories } from "@/lib/catalogDb";
import { requireSectionPage } from "@/lib/pageAccess";

export default async function NewProductPage() {
  await requireSectionPage("products");
  return <ProductEditor product={null} categories={await listCategories()} />;
}
