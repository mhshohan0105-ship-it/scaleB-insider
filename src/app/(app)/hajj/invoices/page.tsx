import type { RawSearchParams } from "../../loadEntityPage";
import { renderInvoiceList } from "../../invoices/routes";

export default function InvoiceListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderInvoiceList("HAJJ", searchParams);
}
