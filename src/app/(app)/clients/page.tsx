import type { RawSearchParams } from "../loadEntityPage";
import { renderPartyList } from "../parties";

export default function ClientsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return renderPartyList("clients", searchParams);
}
