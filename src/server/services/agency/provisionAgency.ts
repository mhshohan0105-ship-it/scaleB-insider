// Creates a new agency with its settings, default roles, owner user and
// starter reference data (PLAN.md section 13: "seed only for new agency
// creation, via service"). System level operation: it runs before any tenant
// session exists, so it uses the base client and passes agencyId explicitly.
import bcrypt from "bcryptjs";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { DEFAULT_ROLES } from "@/lib/permissions";
import { DEFAULT_PREFIXES } from "@/lib/documentPrefixes";
import { prisma } from "@/server/db/prisma";
import { ensureChartOfAccounts } from "@/server/accounting/chartOfAccounts";
import { createMoneyAccountWithLedger } from "@/server/accounting/moneyLedger";
import * as ref from "./referenceData";

type Tx = Prisma.TransactionClient;

export const provisionSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}$/, "Use 2 to 39 lowercase letters, digits or dashes"),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  owner: z.object({
    name: z.string().trim().min(2).max(120),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,60}$/),
    password: z.string().min(8).max(200),
  }),
});

export type ProvisionInput = z.input<typeof provisionSchema>;

/** Inserts reference data for an agency; safe to call repeatedly. */
export async function ensureReferenceData(tx: Tx, agencyId: string) {
  const names = (list: string[]) => list.map((name) => ({ agencyId, name }));
  const opts = { skipDuplicates: true } as const;

  await tx.airport.createMany({
    data: ref.AIRPORTS.map(([iata, name, city, country]) => ({
      agencyId,
      iata,
      name,
      city,
      country,
    })),
    ...opts,
  });
  await tx.airline.createMany({
    data: ref.AIRLINES.map(([iata, name]) => ({ agencyId, iata, name })),
    ...opts,
  });
  await tx.country.createMany({
    data: ref.COUNTRIES.map(([name, iso2]) => ({ agencyId, name, iso2 })),
    ...opts,
  });
  await tx.product.createMany({
    data: ref.PRODUCTS.map(([name, type]) => ({ agencyId, name, type })),
    ...opts,
  });
  await tx.clientCategory.createMany({
    data: ref.CLIENT_CATEGORIES.map(([name, prefix]) => ({ agencyId, name, prefix })),
    ...opts,
  });
  await tx.visaType.createMany({ data: names(ref.VISA_TYPES), ...opts });
  await tx.roomType.createMany({ data: names(ref.ROOM_TYPES), ...opts });
  await tx.transportType.createMany({ data: names(ref.TRANSPORT_TYPES), ...opts });
  await tx.passportStatus.createMany({ data: names(ref.PASSPORT_STATUSES), ...opts });
  await tx.maharam.createMany({ data: names(ref.MAHARAM_RELATIONS), ...opts });
  await tx.department.createMany({ data: names(ref.DEPARTMENTS), ...opts });
  await tx.designation.createMany({ data: names(ref.DESIGNATIONS), ...opts });
}

/** Upserts the default roles and settings row; returns role ids by name. */
/** System chart of accounts and a default "Cash in Hand" money account (idempotent). */
export async function ensureAccounting(tx: Tx, agencyId: string) {
  await ensureChartOfAccounts(tx, agencyId);
  if ((await tx.moneyAccount.count({ where: { agencyId } })) === 0) {
    await createMoneyAccountWithLedger(tx, agencyId, { name: "Cash in Hand", kind: "CASH" });
  }
}

export async function ensureRolesAndSettings(tx: Tx, agencyId: string) {
  await tx.agencySetting.upsert({
    where: { agencyId },
    update: {},
    create: { agencyId, invoicePrefixes: DEFAULT_PREFIXES },
  });
  const roleIds: Record<string, string> = {};
  for (const role of DEFAULT_ROLES) {
    const saved = await tx.role.upsert({
      where: { agencyId_name: { agencyId, name: role.name } },
      update: { permissions: role.permissions as Prisma.InputJsonValue, isSystem: true },
      create: {
        agencyId,
        name: role.name,
        permissions: role.permissions as Prisma.InputJsonValue,
        isSystem: true,
      },
    });
    roleIds[role.name] = saved.id;
  }
  return roleIds;
}

export async function provisionAgency(input: ProvisionInput, client: PrismaClient = prisma) {
  const data = provisionSchema.parse(input);
  const passwordHash = await bcrypt.hash(data.owner.password, 10);

  return client.$transaction(
    async (tx) => {
      const agency = await tx.agency.create({
        data: {
          code: data.code,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
        },
      });
      const roleIds = await ensureRolesAndSettings(tx, agency.id);
      await ensureReferenceData(tx, agency.id);
      await ensureAccounting(tx, agency.id);
      const owner = await tx.user.create({
        data: {
          agencyId: agency.id,
          name: data.owner.name,
          username: data.owner.username,
          passwordHash,
          roleId: roleIds.Owner!,
        },
      });
      await tx.auditLog.create({
        data: { agencyId: agency.id, action: "CREATE", entity: "Agency", entityId: agency.id },
      });
      return { agency, owner, roleIds };
    },
    { timeout: 30_000 },
  );
}
