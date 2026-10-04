import type { RawSearchParams } from "../../loadEntityPage";
import { renderLoanPayments } from "../routes";

export default function LoanPaymentsRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderLoanPayments(searchParams);
}
