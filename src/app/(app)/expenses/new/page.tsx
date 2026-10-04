import type { RawSearchParams } from "../../loadEntityPage";
import { renderVoucherPage } from "../../vouchers/routes";

export default function AddExpensePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("EXPENSE", searchParams, {
    title: "Add Expense",
    afterSave: "/expenses",
  });
}
