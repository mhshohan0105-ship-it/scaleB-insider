import { renderEditInvoice } from "../../../../invoices/routes";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderEditInvoice("HAJJ", id);
}
