import type { RawSearchParams } from "../loadEntityPage";
import { renderVoucherPage } from "../vouchers/routes";

export default function ExpenseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("EXPENSE", searchParams, {
    title: "Expense History",
    withForm: false,
  });
}
