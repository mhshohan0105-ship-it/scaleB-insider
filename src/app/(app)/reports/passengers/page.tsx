import type { RawSearchParams } from "../../loadEntityPage";
import { renderReportGroup } from "../renderReport";

export default function PassengerReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderReportGroup("passengers", searchParams);
}
