import type { RawSearchParams } from "../../loadEntityPage";
import { renderPilgrimList } from "../routes";

export default function HajjRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderPilgrimList(searchParams);
}
