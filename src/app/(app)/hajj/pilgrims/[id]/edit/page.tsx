import { renderPilgrimForm } from "../../../routes";

export default async function EditPilgrimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPilgrimForm(id);
}
