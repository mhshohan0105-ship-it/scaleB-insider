import type { RawSearchParams } from "../../loadEntityPage";
import { renderPassportForm } from "../routes";

export default function NewPassportRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderPassportForm(null, searchParams);
}
