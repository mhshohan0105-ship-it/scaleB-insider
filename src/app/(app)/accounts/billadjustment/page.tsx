import type { RawSearchParams } from "../../loadEntityPage";
import { renderVoucherPage } from "../../vouchers/routes";

export default function BillAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("BILL_ADJUSTMENT", searchParams, {
    description:
      "Raise or lower what a party owes by hand, with a reason. Posts against Bill Adjustments.",
  });
}
