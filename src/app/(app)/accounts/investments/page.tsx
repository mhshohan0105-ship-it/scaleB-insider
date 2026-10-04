import type { RawSearchParams } from "../../loadEntityPage";
import { renderVoucherPage } from "../../vouchers/routes";

export default function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("INVESTMENT", searchParams, {
    title: "Investments",
    description: "Money the agency invests (FDR, shares, ...) and what comes back, with any gain.",
  });
}
