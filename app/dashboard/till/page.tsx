import { Till } from "@/components/till/till";
import { listCategories } from "@/lib/catalogDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { tillItems } from "@/lib/salesDb";
import { planIncludes, shopFeatures } from "@/lib/features";
import { getSalesSettings } from "@/lib/settingsDb";

export default async function TillPage() {
  await requireSectionPage("till");
  const [items, settings, categories, features, customers] = await Promise.all([tillItems(), getSalesSettings(), listCategories(), shopFeatures(), planIncludes("customers")]);
  // Only categories that have something to sell.
  const used = new Set(items.map((i) => i.categoryId));
  return (
    <Till
      initialItems={items}
      initialSettings={settings}
      categories={categories.filter((c) => used.has(c.id))}
      features={features}
      customersEnabled={customers}
    />
  );
}
