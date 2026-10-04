import type { RawSearchParams } from "../loadEntityPage";
import { renderQuotationList } from "./routes";

export default function QuotationsRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderQuotationList(searchParams);
}
