import { renderEditInvoice } from "../../../routes";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderEditInvoice("OTHER", id);
}
