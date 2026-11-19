import { PurchasesScreen } from "@/components/purchases/purchases-screen";
import { requireSectionPage } from "@/lib/pageAccess";
import { listPurchases, listSuppliers } from "@/lib/purchasesDb";

export default async function PurchasesPage() {
  await requireSectionPage("purchases");
  const [first, suppliers] = await Promise.all([listPurchases(50, 0), listSuppliers()]);
  return <PurchasesScreen first={first} suppliers={suppliers} />;
}
