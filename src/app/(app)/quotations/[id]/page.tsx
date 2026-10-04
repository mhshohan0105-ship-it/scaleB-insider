import { renderQuotation } from "../routes";

export default async function QuotationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderQuotation(id);
}
