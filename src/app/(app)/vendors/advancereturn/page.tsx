import type { RawSearchParams } from "../../loadEntityPage";
import { renderAdvanceReturn } from "../../advanceReturnRoute";

export default function AdvanceReturnRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderAdvanceReturn("vendors", searchParams);
}
