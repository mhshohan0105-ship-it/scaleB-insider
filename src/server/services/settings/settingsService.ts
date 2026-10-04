// App Config and Agency Profile (PLAN.md section 8).
// Agency has no agencyId column (it IS the tenant), so it is read/written with
// the base client and always filtered by ctx.agencyId.
import { Prisma } from "@prisma/client";
import { resolvePrefixes, type DocumentTypeKey } from "@/lib/documentPrefixes";
import { appConfigSchema, profileSchema } from "@/lib/schemas/settings";
import { recordAudit } from "@/server/audit/audit";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError } from "../errors";

export interface AppConfig {
  currency: string;
  fiscalYearStart: number;
  aitRatePercent: string;
  aitBase: "BASE_FARE" | "TOTAL_FARE";
  commissionBase: "BASE_FARE" | "TOTAL_FARE";
  invoicePrefixes: Record<DocumentTypeKey, string>;
  invoiceFooter: string | null;
  invoiceTerms: string | null;
  smsEnabled: boolean;
}

async function loadAgency(agencyId: string) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new NotFoundError("Agency");
  return agency;
}

export async function getAppConfig(ctx: ServiceContext): Promise<AppConfig> {
  const db = tenantDb(ctx.agencyId);
  const [agency, setting] = await Promise.all([
    loadAgency(ctx.agencyId),
    db.agencySetting.findFirst(),
  ]);
  return {
    currency: agency.currency,
    fiscalYearStart: agency.fiscalYearStart,
    aitRatePercent: (setting?.aitRatePercent ?? new Prisma.Decimal("0.3")).toString(),
    aitBase: setting?.aitBase ?? "TOTAL_FARE",
    commissionBase: setting?.commissionBase ?? "BASE_FARE",
    invoicePrefixes: resolvePrefixes(setting?.invoicePrefixes),
    invoiceFooter: agency.invoiceFooter,
    invoiceTerms: setting?.invoiceTerms ?? null,
    smsEnabled: setting?.smsEnabled ?? false,
  };
}

export async function saveAppConfig(ctx: ServiceContext, input: unknown): Promise<void> {
  const data = appConfigSchema.parse(input);
  const before = await getAppConfig(ctx);

  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    // Agency is not tenant scoped by the extension; filter by id explicitly.
    await tx.agency.update({
      where: { id: ctx.agencyId },
      data: {
        currency: data.currency,
        fiscalYearStart: data.fiscalYearStart,
        invoiceFooter: data.invoiceFooter ?? null,
      },
    });
    const settingData = {
      aitRatePercent: new Prisma.Decimal(data.aitRatePercent),
      aitBase: data.aitBase,
      commissionBase: data.commissionBase,
      invoicePrefixes: data.invoicePrefixes,
      invoiceTerms: data.invoiceTerms ?? null,
      smsEnabled: data.smsEnabled,
      updatedById: ctx.userId,
    };
    await tx.agencySetting.upsert({
      where: { agencyId: ctx.agencyId },
      update: settingData,
      create: { agencyId: ctx.agencyId, ...settingData },
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "AppConfig",
      entityId: ctx.agencyId,
      before,
      after: data,
    });
  });
}

export type AgencyProfile = {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tradeLicense: string | null;
  iataNo: string | null;
  logoUrl: string | null;
};

export async function getProfile(ctx: ServiceContext): Promise<AgencyProfile> {
  const a = await loadAgency(ctx.agencyId);
  return {
    code: a.code,
    name: a.name,
    address: a.address,
    phone: a.phone,
    email: a.email,
    website: a.website,
    tradeLicense: a.tradeLicense,
    iataNo: a.iataNo,
    logoUrl: a.logoUrl,
  };
}

export async function saveProfile(ctx: ServiceContext, input: unknown): Promise<void> {
  const data = profileSchema.parse(input);
  const before = await getProfile(ctx);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await tx.agency.update({
      where: { id: ctx.agencyId },
      data: {
        name: data.name,
        address: data.address ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        tradeLicense: data.tradeLicense ?? null,
        iataNo: data.iataNo ?? null,
        logoUrl: data.logoUrl ?? null,
      },
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Agency",
      entityId: ctx.agencyId,
      before,
      after: data,
    });
  });
}
