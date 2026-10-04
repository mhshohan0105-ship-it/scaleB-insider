import type { RawSearchParams } from "../../../loadEntityPage";
import { renderInOutPage } from "../routes";

export default function TransferInPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderInOutPage("IN", searchParams);
}
