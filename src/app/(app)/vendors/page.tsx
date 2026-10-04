import type { RawSearchParams } from "../loadEntityPage";
import { renderPartyList } from "../parties";

export default function VendorsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return renderPartyList("vendors", searchParams);
}
