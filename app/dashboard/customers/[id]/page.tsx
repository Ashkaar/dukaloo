import { notFound } from "next/navigation";
import { CustomerPage } from "@/components/customers/customer-page";
import { parseId } from "@/lib/api";
import { customerSales, getCustomer } from "@/lib/customersDb";
import { requireSectionPage } from "@/lib/pageAccess";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSectionPage("customers");
  const id = parseId((await params).id);
  const customer = id ? await getCustomer(id) : null;
  if (!customer) notFound();
  return <CustomerPage customer={customer} sales={await customerSales(customer.id)} />;
}
