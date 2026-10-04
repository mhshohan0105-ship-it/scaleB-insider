import { renderPassportForm } from "../../routes";

export default async function EditPassportRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPassportForm(id);
}
