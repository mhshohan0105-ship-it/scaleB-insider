import "server-only";
// Page renderers for Hajji Management (module "hajji_management").
import { AccessDenied } from "@/components/ModulePlaceholder";
import { CancelForm } from "@/components/hajj/CancelForm";
import { TransferForm } from "@/components/hajj/TransferForm";
import { TransferInForm } from "@/components/hajj/TransferInForm";
import { TransferList } from "@/components/hajj/TransferList";
import { todayIso } from "@/lib/dates";
import { pilgrimActionError } from "@/lib/hajj";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { pilgrimOptions } from "@/server/services/hajj/pilgrimService";
import { listTransfers } from "@/server/services/hajj/transferService";
import { masterOptions } from "@/server/services/masters/masterService";
import type { RawSearchParams } from "../../loadEntityPage";

async function access(action: "view" | "create") {
  const user = await getUserContext();
  return {
    user,
    allowed: can(user.permissions, "hajji_management", action),
    canVoid: can(user.permissions, "hajji_management", "void"),
    ctx: await toServiceContext(user),
  };
}

const LIST_PATH = {
  MOALLEM: "/hajj/management/moallemtransfers",
  GROUP: "/hajj/management/grouptransfers",
};

export async function renderTransferForm(type: "MOALLEM" | "GROUP") {
  const a = await access("create");
  if (!a.allowed) return <AccessDenied />;
  const [pilgrims, groups] = await Promise.all([
    pilgrimOptions(a.ctx),
    masterOptions(a.ctx, "groups"),
  ]);
  return (
    <TransferForm
      type={type}
      today={todayIso()}
      pilgrims={pilgrims}
      groups={groups}
      listPath={LIST_PATH[type]}
    />
  );
}

export async function renderTransferList(
  type: "MOALLEM" | "GROUP",
  searchParams: Promise<RawSearchParams>,
) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const params = parseListParams(await searchParams);
  const data = await listTransfers(a.ctx, type, params);
  return <TransferList type={type} data={data} params={params} canVoid={a.canVoid} />;
}

/** Transfer in / out: the form with the list of earlier ones below. */
export async function renderInOutPage(type: "IN" | "OUT", searchParams: Promise<RawSearchParams>) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const canCreate = can(a.user.permissions, "hajji_management", "create");
  const params = parseListParams(await searchParams);
  const [data, groups, pilgrims] = await Promise.all([
    listTransfers(a.ctx, type, params),
    masterOptions(a.ctx, "groups"),
    type === "OUT" && canCreate ? pilgrimOptions(a.ctx) : Promise.resolve([]),
  ]);
  const path = type === "IN" ? "/hajj/management/transferin" : "/hajj/management/transferout";
  return (
    <>
      {canCreate &&
        (type === "IN" ? (
          <TransferInForm today={todayIso()} groups={groups} />
        ) : (
          <TransferForm
            type="OUT"
            today={todayIso()}
            pilgrims={pilgrims}
            groups={groups}
            listPath={path}
          />
        ))}
      <TransferList
        type={type}
        data={data}
        params={params}
        canVoid={a.canVoid}
        withHeader={false}
      />
    </>
  );
}

export async function renderCancel(
  stage: "PRE_REG" | "REG",
  searchParams: Promise<RawSearchParams>,
) {
  const a = await access("create");
  if (!a.allowed) return <AccessDenied />;
  const all = await pilgrimOptions(a.ctx);
  const action = stage === "PRE_REG" ? "CANCEL_PRE_REG" : "CANCEL_REG";
  const pilgrims = all.filter((p) => !pilgrimActionError(action, p));
  const wanted = firstParam((await searchParams).pilgrim);
  return (
    <CancelForm
      stage={stage}
      today={todayIso()}
      pilgrims={pilgrims}
      initialPilgrimId={pilgrims.some((p) => p.value === wanted) ? wanted : undefined}
      canRefund={can(a.user.permissions, "refund", "create")}
    />
  );
}
