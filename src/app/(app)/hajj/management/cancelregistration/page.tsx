import type { RawSearchParams } from "../../../loadEntityPage";
import { renderCancel } from "../routes";

export default function CancelRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderCancel("REG", searchParams);
}
