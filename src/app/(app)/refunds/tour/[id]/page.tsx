import { renderRefundView } from "../../routes";

export default async function RefundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderRefundView("TOUR", id);
}
