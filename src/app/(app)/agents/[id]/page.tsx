import { renderPartyProfile } from "../../parties";

export default async function AgentsProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return renderPartyProfile("agents", id, searchParams);
}
