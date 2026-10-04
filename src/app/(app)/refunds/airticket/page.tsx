import type { RawSearchParams } from "../../loadEntityPage";
import { renderRefundList } from "../routes";

export default function RefundListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderRefundList("AIR", searchParams);
}
