import { renderLoan } from "../routes";

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderLoan(id);
}
