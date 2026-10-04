import "server-only";
// Page renderers for Passport Management (module "passport").
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import {
  PassportDetail,
  PassportForm,
  PassportListPage,
} from "@/components/passports/PassportPages";
import { todayIso } from "@/lib/dates";
import { firstParam, parseListParams } from "@/lib/listParams";
import type { ExpiryState } from "@/lib/passport";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { masterOptions } from "@/server/services/masters/masterService";
import {
  getPassport,
  listPassports,
  passportFormValues,
} from "@/server/services/passports/passportService";
import type { RawSearchParams } from "../loadEntityPage";

const EXPIRY = ["EXPIRED", "SOON", "OK"];

async function access(action: "view" | "create" | "edit") {
  const user = await getUserContext();
  return {
    user,
    allowed: can(user.permissions, "passport", action),
    ctx: await toServiceContext(user),
  };
}

export async function renderPassportList(searchParams: Promise<RawSearchParams>) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const raw = await searchParams;
  const params = parseListParams(raw);
  const e = firstParam(raw.expiry);
  const filters = {
    expiry: e && EXPIRY.includes(e) ? (e as ExpiryState) : undefined,
    statusId: firstParam(raw.statusId) || undefined,
  };
  const [data, statuses] = await Promise.all([
    listPassports(a.ctx, { ...params, ...filters }, todayIso()),
    masterOptions(a.ctx, "passportstatus"),
  ]);
  return (
    <PassportListPage
      data={data}
      params={params}
      filters={filters}
      statuses={statuses}
      canCreate={can(a.user.permissions, "passport", "create")}
    />
  );
}

export async function renderPassportForm(
  id: string | null,
  searchParams?: Promise<RawSearchParams>,
) {
  const a = await access(id ? "edit" : "create");
  if (!a.allowed) return <AccessDenied />;
  const [statuses, passport] = await Promise.all([
    masterOptions(a.ctx, "passportstatus"),
    id ? getPassport(a.ctx, id, todayIso()) : Promise.resolve(null),
  ]);
  if (id && !passport) notFound();
  const clientId = searchParams ? firstParam((await searchParams).client) : undefined;
  return (
    <PassportForm
      passportId={passport?.id}
      passportNo={passport?.passportNo}
      initial={passport ? passportFormValues(passport) : undefined}
      statuses={statuses}
      clientId={clientId}
    />
  );
}

export async function renderPassport(id: string) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const [passport, statuses] = await Promise.all([
    getPassport(a.ctx, id, todayIso()),
    masterOptions(a.ctx, "passportstatus"),
  ]);
  if (!passport) notFound();
  return (
    <PassportDetail
      passport={passport}
      statuses={statuses}
      canEdit={can(a.user.permissions, "passport", "edit")}
    />
  );
}
