import type { RawSearchParams } from "../../loadEntityPage";
import { renderReport } from "../renderReport";

export default function LedgerReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderReport("party-ledger", searchParams, { filters: ["party", "partyId", "dateRange"] });
}
