import type { RawSearchParams } from "../../loadEntityPage";
import { renderPartyList } from "../../parties";

export default function ClientsCombinedPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderPartyList("combinedclients", searchParams);
}
