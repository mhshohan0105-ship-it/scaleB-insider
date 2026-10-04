import { renderPilgrimProfile } from "../../routes";

export default async function PilgrimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPilgrimProfile(id);
}
