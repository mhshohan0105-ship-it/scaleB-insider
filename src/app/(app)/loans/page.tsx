import type { RawSearchParams } from "../loadEntityPage";
import { renderLoans } from "./routes";

export default function LoansIndexPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderLoans("LOANS", searchParams);
}
