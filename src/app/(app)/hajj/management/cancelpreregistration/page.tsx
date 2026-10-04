import type { RawSearchParams } from "../../../loadEntityPage";
import { renderCancel } from "../routes";

export default function CancelPreRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderCancel("PRE_REG", searchParams);
}
