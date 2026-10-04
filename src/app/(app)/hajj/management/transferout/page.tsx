import type { RawSearchParams } from "../../../loadEntityPage";
import { renderInOutPage } from "../routes";

export default function TransferOutPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderInOutPage("OUT", searchParams);
}
