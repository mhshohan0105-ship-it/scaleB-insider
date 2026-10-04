import { AccessDenied } from "@/components/ModulePlaceholder";
import { MasterPage } from "@/components/masters/MasterPage";
import { PageHeader } from "@/components/PageHeader";
import { TOUR_MASTER_KEYS, isMasterKey, type MasterKey } from "@/lib/masters";
import { loadEntityPage, type RawSearchParams } from "../../loadEntityPage";
import { TourTabs } from "./TourTabs";

export default async function TourItineraryPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const tab = typeof raw.tab === "string" && isMasterKey(raw.tab) ? raw.tab : undefined;
  const active: MasterKey = tab && TOUR_MASTER_KEYS.includes(tab) ? tab : TOUR_MASTER_KEYS[0]!;

  const data = await loadEntityPage(active, raw);
  if (!data) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Tour Itinerary"
        description="Default items and costs that tour package invoices start from."
      />
      <MasterPage {...data} hideHeader top={<TourTabs active={active} />} />
    </>
  );
}
