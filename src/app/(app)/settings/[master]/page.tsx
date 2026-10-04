import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { MasterPage } from "@/components/masters/MasterPage";
import { isMasterKey } from "@/lib/masters";
import { loadEntityPage, type RawSearchParams } from "../../loadEntityPage";

export default async function MasterListPage({
  params,
  searchParams,
}: {
  params: Promise<{ master: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { master } = await params;
  if (!isMasterKey(master)) notFound();

  const data = await loadEntityPage(master, await searchParams);
  if (!data) return <AccessDenied />;
  return <MasterPage {...data} />;
}
