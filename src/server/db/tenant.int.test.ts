// Phase 1 acceptance: two agencies cannot see or change each other's data.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { exportTenantData } from "@/server/services/backup/backupService";
import {
  listMasters,
  masterOptions,
  saveMaster,
  setMasterActive,
} from "@/server/services/masters/masterService";
import { listRoles } from "@/server/services/roles/roleService";
import { listUsers, updateUser } from "@/server/services/users/userService";
import { verifyLogin } from "@/server/services/auth/login";
import { makeAgency, TEST_PASSWORD } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>;
let B: Awaited<ReturnType<typeof makeAgency>>;
let bAirportId: string;
let bDesignationId: string;

const page = { page: 1, pageSize: 100, q: "", status: "all" as const };

beforeAll(async () => {
  A = await makeAgency("alpha");
  B = await makeAgency("bravo");
  bAirportId = (
    await saveMaster(B.ctx, "airports", null, { iata: "ZZB", name: "Bravo Only Field" })
  ).id;
  bDesignationId = (await saveMaster(B.ctx, "designations", null, { name: "Bravo Secret Title" }))
    .id;
});

describe("tenant client", () => {
  it("reads only the tenant's rows", async () => {
    const aAirports = await tenantDb(A.agency.id).airport.findMany();
    expect(aAirports.length).toBeGreaterThan(0);
    expect(aAirports.every((r) => r.agencyId === A.agency.id)).toBe(true);
    expect(aAirports.find((r) => r.id === bAirportId)).toBeUndefined();
  });

  it("cannot fetch another tenant's row by id", async () => {
    const db = tenantDb(A.agency.id);
    expect(await db.airport.findFirst({ where: { id: bAirportId } })).toBeNull();
    expect(await db.airport.findUnique({ where: { id: bAirportId } })).toBeNull();
    // Even a caller supplied agencyId is overridden.
    expect(
      await db.airport.findFirst({ where: { id: bAirportId, agencyId: B.agency.id } }),
    ).toBeNull();
  });

  it("cannot update or delete another tenant's row", async () => {
    const db = tenantDb(A.agency.id);
    await expect(
      db.airport.update({ where: { id: bAirportId }, data: { name: "Hijacked" } }),
    ).rejects.toThrow();
    expect(
      (await db.airport.updateMany({ where: { id: bAirportId }, data: { name: "x" } })).count,
    ).toBe(0);
    expect((await db.airport.deleteMany({ where: { id: bAirportId } })).count).toBe(0);
    const still = await prisma.airport.findUnique({ where: { id: bAirportId } });
    expect(still?.name).toBe("Bravo Only Field");
  });

  it("stamps creates with the tenant even if another agencyId is passed", async () => {
    const created = await tenantDb(A.agency.id).visaType.create({
      data: { agencyId: B.agency.id, name: "Smuggled" },
    });
    expect(created.agencyId).toBe(A.agency.id);
  });

  it("cannot move a row to another agency via update", async () => {
    const db = tenantDb(A.agency.id);
    const row = await db.roomType.findFirstOrThrow();
    await db.roomType.update({
      where: { id: row.id },
      data: { agencyId: B.agency.id, name: "Moved?" },
    });
    const after = await prisma.roomType.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.agencyId).toBe(A.agency.id);
  });

  it("scopes interactive transactions too", async () => {
    const found = await tenantDb(A.agency.id).$transaction((tx) =>
      tx.airport.findFirst({ where: { id: bAirportId } }),
    );
    expect(found).toBeNull();
  });

  it("scopes counts and aggregates", async () => {
    const aCount = await tenantDb(A.agency.id).airport.count();
    const direct = await prisma.airport.count({ where: { agencyId: A.agency.id } });
    expect(aCount).toBe(direct);
  });
});

describe("services respect tenant boundaries", () => {
  it("master lists and options exclude other agencies", async () => {
    const list = await listMasters(A.ctx, "airports", { ...page, q: "ZZB" });
    expect(list.total).toBe(0);
    const opts = await masterOptions(A.ctx, "designations");
    expect(opts.find((o) => o.value === bDesignationId)).toBeUndefined();
  });

  it("cannot reference another agency's master in a foreign key", async () => {
    await expect(
      saveMaster(A.ctx, "employees", null, {
        name: "Crossover",
        salary: "1000",
        commissionPercent: "0",
        designationId: bDesignationId,
      }),
    ).rejects.toThrow(/Designation not found/);
  });

  it("cannot edit or deactivate another agency's master", async () => {
    await expect(
      saveMaster(A.ctx, "airports", bAirportId, { iata: "ZZB", name: "Mine now" }),
    ).rejects.toThrow(/not found/);
    await expect(setMasterActive(A.ctx, "airports", bAirportId, false)).rejects.toThrow(
      /not found/,
    );
  });

  it("users and roles are per agency", async () => {
    const users = await listUsers(A.ctx, page);
    expect(users.rows.map((u) => u.id)).not.toContain(B.owner.id);
    const roles = await listRoles(A.ctx);
    expect(roles.map((r) => r.id)).not.toContain(B.roleIds.Owner);
    // Assigning another agency's role is rejected.
    await expect(
      updateUser(A.ctx, A.viewer.id, {
        name: "Viewer",
        roleId: B.roleIds.Owner,
        email: "",
        phone: "",
        employeeId: "",
      }),
    ).rejects.toThrow(/Role not found/);
  });

  it("the backup export contains only the tenant's rows", async () => {
    const dump = await exportTenantData(A.ctx);
    const json = JSON.stringify(dump);
    expect(json).not.toContain(B.agency.id);
    expect(json).not.toContain("passwordHash");
    expect((dump.tables.Airport as unknown[]).length).toBeGreaterThan(0);
  });

  it("login is bound to the agency code", async () => {
    const ok = await verifyLogin({
      agencyCode: A.agency.code,
      username: "owner",
      password: TEST_PASSWORD,
    });
    expect(ok.ok && ok.user.agencyId).toBe(A.agency.id);
    // Same username exists in both agencies; each code resolves its own user.
    const other = await verifyLogin({
      agencyCode: B.agency.code,
      username: "owner",
      password: TEST_PASSWORD,
    });
    expect(other.ok && other.user.agencyId).toBe(B.agency.id);
    const wrong = await verifyLogin({
      agencyCode: "no-such-agency",
      username: "owner",
      password: TEST_PASSWORD,
    });
    expect(wrong.ok).toBe(false);
  });
});

describe("audit trail", () => {
  it("records create and update with before/after", async () => {
    const { id } = await saveMaster(A.ctx, "airlines", null, { iata: "Q9", name: "Audit Air" });
    await saveMaster(A.ctx, "airlines", id, {
      iata: "Q9",
      name: "Audit Air Renamed",
      commissionPercent: "7",
    });
    const logs = await tenantDb(A.agency.id).auditLog.findMany({
      where: { entity: "Airline", entityId: id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual(["CREATE", "UPDATE"]);
    expect((logs[1]!.before as { name: string }).name).toBe("Audit Air");
    expect((logs[1]!.after as { name: string }).name).toBe("Audit Air Renamed");
    expect(logs[1]!.userId).toBe(A.owner.id);
  });
});
