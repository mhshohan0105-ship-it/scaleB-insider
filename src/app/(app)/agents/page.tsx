import type { RawSearchParams } from "../loadEntityPage";
import { renderPartyList } from "../parties";

export default function AgentsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return renderPartyList("agents", searchParams);
}
