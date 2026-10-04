import type { RawSearchParams } from "../../loadEntityPage";
import { renderVoucherPage } from "../../vouchers/routes";

export default function NonInvoiceIncomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("NON_INVOICE_INCOME", searchParams, {
    description: "Income that is not from an invoice (e.g. office rent received, bank interest).",
  });
}
