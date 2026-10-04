import type { RawSearchParams } from "../../loadEntityPage";
import { renderReportGroup } from "../renderReport";

export default function PassportReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderReportGroup("passport", searchParams);
}
