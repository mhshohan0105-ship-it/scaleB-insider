import type { RawSearchParams } from "../../loadEntityPage";
import { renderRefundList } from "../routes";

export default function RefundListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderRefundList("OTHER_PACKAGE_HAJJ", searchParams);
}
