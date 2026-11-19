import { notFound } from "next/navigation";
import { CustomerPage } from "@/components/customers/customer-page";
import { parseId } from "@/lib/api";
import { customerBalance, customerPaymentsOf, customerSales, getCustomer } from "@/lib/customersDb";
import { shopFeatures } from "@/lib/features";
import { getSalesSettings } from "@/lib/settingsDb";
import { requireSectionPage } from "@/lib/pageAccess";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await requireSectionPage("customers");
  const id = parseId((await params).id);
  const customer = id ? await getCustomer(id) : null;
  if (!customer) notFound();
  const [sales, balanceCents, payments, settings, features] = await Promise.all([
    customerSales(customer.id),
    customerBalance(customer.id),
    customerPaymentsOf(customer.id),
    getSalesSettings(),
    shopFeatures(),
  ]);
  return (
    <CustomerPage
      customer={customer}
      sales={sales}
      account={{ balanceCents, payments, creditEnabled: settings.creditSales && features.includes("credit"), canDelete: viewer.isOwner }}
    />
  );
}
