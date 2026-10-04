import type { RawSearchParams } from "../../../loadEntityPage";
import { renderTransferList } from "../routes";

export default function MoallemTransferListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderTransferList("MOALLEM", searchParams);
}
