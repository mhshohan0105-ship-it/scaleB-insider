import type { RawSearchParams } from "../../../loadEntityPage";
import { renderTransferList } from "../routes";

export default function GroupTransferListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderTransferList("GROUP", searchParams);
}
