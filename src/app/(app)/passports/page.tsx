import type { RawSearchParams } from "../loadEntityPage";
import { renderPassportList } from "./routes";

export default function PassportListRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderPassportList(searchParams);
}
