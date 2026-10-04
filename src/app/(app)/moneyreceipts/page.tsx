import { AccessDenied } from "@/components/ModulePlaceholder";
import { parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyReceipts } from "@/server/services/payments/receiptService";
import type { RawSearchParams } from "../loadEntityPage";
import { ReceiptList } from "./ReceiptList";

export default async function MoneyReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "money_receipt", "view")) return <AccessDenied />;
  const params = parseListParams(await searchParams);
  const data = await listMoneyReceipts(await toServiceContext(user), params);
  return (
    <ReceiptList
      data={data}
      params={params}
      canCreate={can(user.permissions, "money_receipt", "create")}
    />
  );
}
