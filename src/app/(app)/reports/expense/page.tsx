import type { RawSearchParams } from "../../loadEntityPage";
import { renderReportGroup } from "../renderReport";

export default function ExpenseReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderReportGroup("expense", searchParams);
}
