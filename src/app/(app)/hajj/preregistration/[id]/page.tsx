import { renderInvoiceView } from "../../../invoices/routes";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderInvoiceView("HAJJ_PRE_REG", id);
}
