import "server-only";
// Page renderers for pilgrims (Hajj Registration, pilgrim profile / form).
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { PilgrimForm } from "@/components/hajj/PilgrimForm";
import { PilgrimList } from "@/components/hajj/PilgrimList";
import { PilgrimProfile } from "@/components/hajj/PilgrimProfile";
import { todayIso } from "@/lib/dates";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getPilgrim, listPilgrims, pilgrimFormValues } from "@/server/services/hajj/pilgrimService";
import { masterOptions } from "@/server/services/masters/masterService";
import type { RawSearchParams } from "../loadEntityPage";

async function access(action: "view" | "create" | "edit") {
  const user = await getUserContext();
  return {
    user,
    allowed: can(user.permissions, "hajj", action),
    ctx: await toServiceContext(user),
  };
}

export async function renderPilgrimList(searchParams: Promise<RawSearchParams>) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const raw = await searchParams;
  const params = parseListParams(raw);
  const yearText = firstParam(raw.year);
  const filters = {
    pilgrimStatus: firstParam(raw.pilgrimStatus) || undefined,
    year: yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : undefined,
    groupId: firstParam(raw.groupId) || undefined,
  };
  const [data, groups] = await Promise.all([
    listPilgrims(a.ctx, { ...params, ...filters }),
    masterOptions(a.ctx, "groups"),
  ]);
  return (
    <PilgrimList
      data={data}
      params={params}
      filters={filters}
      groups={groups}
      canCreate={can(a.user.permissions, "hajj", "create")}
      canEdit={can(a.user.permissions, "hajj", "edit")}
      today={todayIso()}
    />
  );
}

export async function renderPilgrimForm(id: string | null) {
  const a = await access(id ? "edit" : "create");
  if (!a.allowed) return <AccessDenied />;
  const [groups, maharams, pilgrim] = await Promise.all([
    masterOptions(a.ctx, "groups"),
    masterOptions(a.ctx, "maharam"),
    id ? getPilgrim(a.ctx, id) : Promise.resolve(null),
  ]);
  if (id && !pilgrim) notFound();
  return (
    <PilgrimForm
      pilgrimId={pilgrim?.id}
      pilgrimName={pilgrim?.name}
      initial={pilgrim ? pilgrimFormValues(pilgrim) : undefined}
      defaultYear={Number(todayIso().slice(0, 4))}
      groups={groups}
      maharams={maharams}
    />
  );
}

export async function renderPilgrimProfile(id: string) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const pilgrim = await getPilgrim(a.ctx, id);
  if (!pilgrim) notFound();
  return (
    <PilgrimProfile
      pilgrim={pilgrim}
      canEdit={can(a.user.permissions, "hajj", "edit")}
      canManage={can(a.user.permissions, "hajji_management", "create")}
      canRefund={can(a.user.permissions, "refund", "create")}
      today={todayIso()}
    />
  );
}
