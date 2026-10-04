// Development seed: one demo agency with default roles, settings, reference
// data and users. Idempotent, safe to run repeatedly. Passwords come from env
// (see .env.example).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { backfillOpeningEntries } from "../src/server/accounting/backfill";
import {
  ensureAccounting,
  ensureReferenceData,
  ensureRolesAndSettings,
} from "../src/server/services/agency/provisionAgency";
import { saveExpenseHead } from "../src/server/services/expense/expenseHeadService";
import { createPilgrim } from "../src/server/services/hajj/pilgrimService";
import { savePassport } from "../src/server/services/passports/passportService";
import { saveMaster } from "../src/server/services/masters/masterService";
import { linkCombinedAccounts } from "../src/server/services/parties/combinedService";
import { tenantDb } from "../src/server/db/tenant";

const prisma = new PrismaClient();

const DEMO_AGENCY_CODE = "demo";
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Insider#2026";
const viewerPassword = process.env.SEED_VIEWER_PASSWORD ?? "Viewer#2026";

async function main() {
  const agency = await prisma.agency.upsert({
    where: { code: DEMO_AGENCY_CODE },
    update: {},
    create: {
      code: DEMO_AGENCY_CODE,
      name: "Demo Travels",
      address: "House 12, Road 5, Dhanmondi, Dhaka",
      phone: "+8801700000000",
      email: "demo@example.com",
      invoiceFooter: "Thank you for travelling with us.",
    },
  });

  const roles = await prisma.$transaction(
    async (tx) => {
      const ids = await ensureRolesAndSettings(tx, agency.id);
      await ensureReferenceData(tx, agency.id);
      await ensureAccounting(tx, agency.id);
      return ids;
    },
    { timeout: 30_000 },
  );

  const users = [
    {
      username: "admin",
      name: "Agency Owner",
      role: "Owner",
      password: ownerPassword,
      // The demo owner also runs the platform (Platform admin page).
      isSuperAdmin: true,
    },
    {
      username: "viewer",
      name: "Read Only User",
      role: "Viewer",
      password: viewerPassword,
      isSuperAdmin: false,
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { agencyId_username: { agencyId: agency.id, username: u.username } },
      update: {
        passwordHash,
        roleId: roles[u.role]!,
        isActive: true,
        isSuperAdmin: u.isSuperAdmin,
      },
      create: {
        isSuperAdmin: u.isSuperAdmin,
        agencyId: agency.id,
        username: u.username,
        name: u.name,
        passwordHash,
        roleId: roles[u.role]!,
      },
    });
  }

  // Demo parties, created through the service so they get codes and audit rows.
  const owner = await prisma.user.findUniqueOrThrow({
    where: { agencyId_username: { agencyId: agency.id, username: "admin" } },
  });
  const ctx = { agencyId: agency.id, userId: owner.id };
  if ((await prisma.client.count({ where: { agencyId: agency.id } })) === 0) {
    const opening = (amount: string, type: "RECEIVABLE" | "PAYABLE") => ({
      openingBalance: amount,
      openingBalanceType: type,
    });
    for (const c of [
      { name: "Abdul Karim", phone: "01711000001", ...opening("12500", "RECEIVABLE") },
      { name: "Nasima Akter", phone: "01811000002", ...opening("0", "RECEIVABLE") },
      { name: "Rafiq Hasan", phone: "01911000003", ...opening("3000", "PAYABLE") },
    ]) {
      await saveMaster(ctx, "clients", null, { type: "INDIVIDUAL", creditLimit: "0", ...c });
    }
    await saveMaster(ctx, "clients", null, {
      name: "Meghna Garments Ltd",
      type: "CORPORATE",
      phone: "029000001",
      creditLimit: "200000",
      ...opening("45000", "RECEIVABLE"),
    });
    for (const v of [
      {
        name: "Skyline Air Consolidators",
        type: "AIRLINE_CONSOLIDATOR",
        ...opening("80000", "PAYABLE"),
      },
      { name: "Gulf Visa Services", type: "VISA", ...opening("0", "PAYABLE") },
      { name: "Makkah Hotels Group", type: "HOTEL", ...opening("0", "PAYABLE") },
    ]) {
      await saveMaster(ctx, "vendors", null, { commissionPercent: "0", ...v });
    }
    await saveMaster(ctx, "agents", null, {
      name: "Jamal Uddin",
      phone: "01611000004",
      commissionPercent: "2",
      ...opening("0", "PAYABLE"),
    });
    await saveMaster(ctx, "combinedclients", null, {
      name: "Rupsha Travels",
      contactPerson: "Mr. Sohel",
      ...opening("15000", "RECEIVABLE"),
    });
  }

  // Combined clients created before they had client / vendor accounts get them.
  const unlinked = await prisma.combinedClient.findMany({
    where: { agencyId: agency.id, OR: [{ clientId: null }, { vendorId: null }] },
    select: { id: true },
  });
  for (const c of unlinked)
    await tenantDb(agency.id).$transaction((tx) => linkCombinedAccounts(tx, ctx, c.id));
  if (unlinked.length) console.log(`Linked ${unlinked.length} combined client(s).`);

  // Parties created before the accounting engine existed get their opening entries.
  const backfilled = await backfillOpeningEntries(ctx);
  if (backfilled) console.log(`Posted ${backfilled} opening balance entries.`);

  // Hajj demo: a group, maharam relations and two pilgrims paid for by Abdul Karim.
  if ((await prisma.pilgrim.count({ where: { agencyId: agency.id } })) === 0) {
    const group =
      (await prisma.group.findFirst({ where: { agencyId: agency.id, type: "HAJJ" } })) ??
      (await saveMaster(ctx, "groups", null, {
        name: "Hajj 2027 Group A",
        type: "HAJJ",
        year: 2027,
        leaderName: "Maulana Abdur Rahim",
      }));
    if ((await prisma.maharam.count({ where: { agencyId: agency.id } })) === 0) {
      for (const name of ["Husband", "Wife", "Father", "Son", "Brother"])
        await saveMaster(ctx, "maharam", null, { name });
    }
    const husband = await prisma.maharam.findFirst({
      where: { agencyId: agency.id, name: "Husband" },
    });
    const payer = await prisma.client.findFirst({
      where: { agencyId: agency.id, name: "Abdul Karim" },
    });
    if (payer) {
      const today = new Date().toISOString().slice(0, 10);
      const common = {
        clientId: payer.id,
        hajjYear: 2027,
        groupId: group.id,
        moallem: "Moallem 114",
      };
      await createPilgrim(
        ctx,
        {
          ...common,
          name: "Abdul Karim",
          gender: "MALE",
          passportNo: "A01234567",
          trackingNo: "N2027001",
        },
        today,
      );
      await createPilgrim(
        ctx,
        {
          ...common,
          name: "Salma Karim",
          gender: "FEMALE",
          passportNo: "A07654321",
          trackingNo: "N2027002",
          maharamId: husband?.id,
          maharamName: "Abdul Karim",
        },
        today,
      );
    }
  }

  // Common expense heads.
  if ((await prisma.expenseHead.count({ where: { agencyId: agency.id } })) === 0) {
    for (const name of [
      "Office Rent",
      "Utilities",
      "Internet & Phone",
      "Stationery",
      "Entertainment",
    ])
      await saveExpenseHead(ctx, null, { name });
  }

  // Passports: one expiring soon (shows on the dashboard) and one valid.
  if ((await prisma.passport.count({ where: { agencyId: agency.id } })) === 0) {
    const karim = await prisma.client.findFirst({
      where: { agencyId: agency.id, name: "Abdul Karim" },
    });
    const status = await prisma.passportStatus.findFirst({
      where: { agencyId: agency.id },
      orderBy: { name: "asc" },
    });
    const inMonths = (m: number) => {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() + m);
      return d.toISOString().slice(0, 10);
    };
    await savePassport(ctx, null, {
      passportNo: "A01234567",
      name: "Abdul Karim",
      clientId: karim?.id ?? null,
      expiryDate: inMonths(3),
      statusId: status?.id ?? null,
      phone: "01711000001",
    });
    await savePassport(ctx, null, {
      passportNo: "A07654321",
      name: "Salma Karim",
      clientId: karim?.id ?? null,
      expiryDate: inMonths(40),
    });
  }

  console.log(`Seeded agency "${agency.name}" (code: ${agency.code}) with ${users.length} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
