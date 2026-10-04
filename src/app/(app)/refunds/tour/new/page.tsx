import type { RawSearchParams } from "../../../loadEntityPage";
import { renderNewRefund } from "../../routes";

export default function NewRefundPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderNewRefund("TOUR", searchParams);
}
