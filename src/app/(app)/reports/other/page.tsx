import type { RawSearchParams } from "../../loadEntityPage";
import { renderReportGroup } from "../renderReport";

export default function OtherReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderReportGroup("other", searchParams);
}
