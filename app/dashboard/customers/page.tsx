import { CustomerList } from "@/components/customers/customer-list";
import { listCustomers } from "@/lib/customersDb";
import { requireSectionPage } from "@/lib/pageAccess";

export default async function CustomersPage() {
  await requireSectionPage("customers");
  return <CustomerList first={await listCustomers("", 50, 0)} />;
}
