import { ExpensesScreen } from "@/components/expenses/expenses-screen";
import { listExpenses, listExpenseTypes } from "@/lib/expensesDb";
import { requireSectionPage } from "@/lib/pageAccess";
import { requestToday } from "@/lib/settingsDb";

const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

export default async function ExpensesPage() {
  const { viewer } = await requireSectionPage("expenses");
  const { day } = await requestToday();
  const month = day.slice(0, 7);
  const [expenses, types] = await Promise.all([listExpenses(`${month}-01`, `${nextMonth(month)}-01`), listExpenseTypes()]);
  return <ExpensesScreen today={day} first={{ month, expenses }} types={types} canDelete={viewer.isOwner} />;
}
