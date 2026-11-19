import { notFound } from "next/navigation";
import { PurchaseView } from "@/components/purchases/purchase-view";
import { parseId } from "@/lib/api";
import { requireSectionPage } from "@/lib/pageAccess";
import { getPurchase } from "@/lib/purchasesDb";

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await requireSectionPage("purchases");
  const id = parseId((await params).id);
  const purchase = id ? await getPurchase(id) : null;
  if (!purchase) notFound();
  return <PurchaseView purchase={purchase} canCancel={viewer.isOwner} />;
}
