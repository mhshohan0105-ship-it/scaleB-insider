import { renderInvoiceView } from "../../routes";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderInvoiceView("OTHER_PACKAGE", id);
}
