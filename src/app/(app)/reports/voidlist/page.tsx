import type { RawSearchParams } from "../../loadEntityPage";
import { renderReport } from "../renderReport";

export default function VoidListPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return renderReport("void-list", searchParams, { filters: ["dateRange"] });
}
