import type { RawSearchParams } from "../../loadEntityPage";
import { renderVoucherPage } from "../../vouchers/routes";

export default function AgentPaymentPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("AGENT_PAYMENT", searchParams, {
    description: "Pay agents the commission they are owed.",
  });
}
