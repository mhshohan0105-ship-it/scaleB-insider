import type { RawSearchParams } from "../../loadEntityPage";
import { renderReportGroup } from "../renderReport";

export default function AirTicketReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderReportGroup("airticket", searchParams);
}
