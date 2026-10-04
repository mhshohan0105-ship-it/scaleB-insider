import type { RawSearchParams } from "../../loadEntityPage";
import { renderVoucherPage } from "../../vouchers/routes";

export default function IncentiveIncomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("INCENTIVE_INCOME", searchParams, {
    description:
      "Incentives from airlines and vendors, received in money or taken off what you owe them.",
  });
}
