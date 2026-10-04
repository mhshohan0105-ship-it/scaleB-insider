import { renderQuotationForm } from "../../routes";

export default async function EditQuotationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderQuotationForm(id);
}
