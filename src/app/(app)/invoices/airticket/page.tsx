import type { RawSearchParams } from "../../loadEntityPage";
import { renderInvoiceList } from "../routes";

export default function InvoiceListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderInvoiceList("AIR", searchParams);
}
