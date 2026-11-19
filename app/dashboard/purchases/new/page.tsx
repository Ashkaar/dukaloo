import { PurchaseForm } from "@/components/purchases/purchase-form";
import { requireSectionPage } from "@/lib/pageAccess";
import { buyableItems, listSuppliers } from "@/lib/purchasesDb";

export default async function NewPurchasePage() {
  await requireSectionPage("purchases");
  const [items, suppliers] = await Promise.all([buyableItems(), listSuppliers()]);
  return <PurchaseForm items={items} suppliers={suppliers} />;
}
