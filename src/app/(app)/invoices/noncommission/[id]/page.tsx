import { renderInvoiceView } from "../../routes";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderInvoiceView("NON_COMMISSION", id);
}
