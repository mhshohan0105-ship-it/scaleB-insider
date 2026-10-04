import { renderPassport } from "../routes";

export default async function PassportRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPassport(id);
}
