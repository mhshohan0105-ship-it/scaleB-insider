import type { RawSearchParams } from "../../loadEntityPage";
import { renderReport } from "../renderReport";

export default function DueAdvanceReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderReport("due-advance", searchParams, { filters: ["party", "asOf", "show"] });
}
