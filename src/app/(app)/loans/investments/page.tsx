import type { RawSearchParams } from "../../loadEntityPage";
import { renderLoans } from "../routes";

export default function ReceivedInvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderLoans("INVESTMENT", searchParams);
}
