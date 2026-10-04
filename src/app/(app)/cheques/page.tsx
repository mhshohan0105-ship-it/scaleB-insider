import type { ChequeDirection, ChequeStatus } from "@prisma/client";
import { ChequesPage } from "@/components/cheques/ChequesPage";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { todayIso } from "@/lib/dates";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listCheques } from "@/server/services/cheques/chequeService";
import type { RawSearchParams } from "../loadEntityPage";

const DIRECTIONS = ["RECEIVED", "ISSUED"];
const STATUSES = ["PENDING", "DEPOSITED", "CLEARED", "BOUNCED", "CANCELLED"];

export default async function ChequesRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "cheques", "view")) return <AccessDenied />;
  const raw = await searchParams;
  const params = parseListParams(raw);
  const d = firstParam(raw.direction);
  const s = firstParam(raw.chequeStatus);
  const filters = {
    direction: d && DIRECTIONS.includes(d) ? (d as ChequeDirection) : undefined,
    chequeStatus: s && STATUSES.includes(s) ? (s as ChequeStatus) : undefined,
  };
  const data = await listCheques(await toServiceContext(user), { ...params, ...filters });
  return (
    <ChequesPage
      data={data}
      params={params}
      filters={filters}
      canEdit={can(user.permissions, "cheques", "edit")}
      today={todayIso()}
    />
  );
}
