import { renderPartyProfile } from "../../../parties";

export default async function ClientsCombinedProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return renderPartyProfile("combinedclients", id, searchParams);
}
