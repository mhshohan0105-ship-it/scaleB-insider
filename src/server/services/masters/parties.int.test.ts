// Phase 2: parties (clients, combined clients, vendors, agents).
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import {
  getEntity,
  listMasters,
  saveMaster,
  searchEntityOptions,
} from "@/server/services/masters/masterService";
import { makeAgency } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>;
let B: Awaited<ReturnType<typeof makeAgency>>;

const client = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  type: "INDIVIDUAL",
  creditLimit: "0",
  openingBalance: "0",
  openingBalanceType: "RECEIVABLE",
  ...extra,
});

const vendor = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  type: "AIRLINE_CONSOLIDATOR",
  commissionPercent: "0",
  openingBalance: "0",
  openingBalanceType: "PAYABLE",
  ...extra,
});

beforeAll(async () => {
  A = await makeAgency("party-a");
  B = await makeAgency("party-b");
});

describe("party codes", () => {
  it("numbers each party kind per agency", async () => {
    const c1 = await saveMaster(A.ctx, "clients", null, client("Rahim Uddin"));
    const c2 = await saveMaster(A.ctx, "clients", null, client("Karim Ahmed"));
    const v1 = await saveMaster(A.ctx, "vendors", null, vendor("Sky Consolidators"));
    const b1 = await saveMaster(B.ctx, "clients", null, client("Other Agency Client"));

    expect((await getEntity(A.ctx, "clients", c1.id))?.code).toBe("CL-00001");
    expect((await getEntity(A.ctx, "clients", c2.id))?.code).toBe("CL-00002");
    expect((await getEntity(A.ctx, "vendors", v1.id))?.code).toBe("VN-00001");
    expect((await getEntity(B.ctx, "clients", b1.id))?.code).toBe("CL-00001");
  });

  it("gives concurrent creates distinct, gap-free codes", async () => {
    const C = await makeAgency("party-c");
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        saveMaster(C.ctx, "agents", null, {
          name: `Agent ${i}`,
          commissionPercent: "2",
          openingBalance: "0",
          openingBalanceType: "PAYABLE",
        }),
      ),
    );
    const codes = await tenantDb(C.agency.id).agent.findMany({
      where: { id: { in: results.map((r) => r.id) } },
      select: { code: true },
    });
    const sorted = codes.map((c) => c.code).sort();
    expect(new Set(sorted).size).toBe(25);
    expect(sorted[0]).toBe("AG-00001");
    expect(sorted[24]).toBe("AG-00025");
  });

  it("ignores a code sent by the caller", async () => {
    const { id } = await saveMaster(A.ctx, "agents", null, {
      name: "Sneaky",
      code: "AG-99999",
      commissionPercent: "0",
      openingBalance: "0",
      openingBalanceType: "PAYABLE",
    });
    expect((await getEntity(A.ctx, "agents", id))?.code).not.toBe("AG-99999");
  });
});

describe("opening balance", () => {
  it("sets the signed cached balance on create", async () => {
    const due = await saveMaster(
      A.ctx,
      "clients",
      null,
      client("Due Client", { openingBalance: "5000.50" }),
    );
    const adv = await saveMaster(
      A.ctx,
      "clients",
      null,
      client("Advance Client", { openingBalance: "1200", openingBalanceType: "PAYABLE" }),
    );
    const payable = await saveMaster(
      A.ctx,
      "vendors",
      null,
      vendor("Payable Vendor", { openingBalance: "3000" }),
    );

    expect((await getEntity(A.ctx, "clients", due.id))?.balance).toBe("5000.5");
    expect((await getEntity(A.ctx, "clients", adv.id))?.balance).toBe("-1200");
    expect((await getEntity(A.ctx, "vendors", payable.id))?.balance).toBe("-3000");
  });

  it("moves the balance by the change when the opening is edited", async () => {
    const { id } = await saveMaster(
      A.ctx,
      "clients",
      null,
      client("Edit Me", { openingBalance: "1000" }),
    );
    // Simulate other activity already in the cached balance (+400).
    await tenantDb(A.agency.id).client.update({
      where: { id },
      data: { balance: { increment: 400 } },
    });

    await saveMaster(
      A.ctx,
      "clients",
      id,
      client("Edit Me", { openingBalance: "250", openingBalanceType: "PAYABLE" }),
    );
    expect((await getEntity(A.ctx, "clients", id))?.balance).toBe("150");

    const audit = await tenantDb(A.agency.id).auditLog.findFirst({
      where: { entity: "Client", entityId: id, action: "UPDATE" },
    });
    expect((audit?.before as { openingBalance: string }).openingBalance).toBe("1000");
  });

  it("rejects negative or malformed amounts", async () => {
    await expect(
      saveMaster(A.ctx, "clients", null, client("Bad", { openingBalance: "-5" })),
    ).rejects.toThrow();
    await expect(
      saveMaster(A.ctx, "clients", null, client("Bad", { openingBalance: "1.234" })),
    ).rejects.toThrow();
  });
});

describe("tenant boundaries for parties", () => {
  it("cannot read, list or search another agency's parties", async () => {
    const { id } = await saveMaster(
      B.ctx,
      "clients",
      null,
      client("Bravo Secret", { phone: "01999999999" }),
    );
    expect(await getEntity(A.ctx, "clients", id)).toBeNull();
    expect(
      (
        await listMasters(A.ctx, "clients", {
          page: 1,
          pageSize: 50,
          q: "Bravo Secret",
          status: "all",
        })
      ).total,
    ).toBe(0);
    expect(await searchEntityOptions(A.ctx, "clients", "01999999999")).toEqual([]);
    // includeId cannot be used to pull a foreign row in either.
    expect((await searchEntityOptions(A.ctx, "clients", "", id)).map((o) => o.value)).not.toContain(
      id,
    );
  });

  it("cannot link a client to another agency's category or a tour item to another agency's vendor", async () => {
    const bCategory = await prisma.clientCategory.findFirstOrThrow({
      where: { agencyId: B.agency.id },
    });
    await expect(
      saveMaster(A.ctx, "clients", null, client("Cross", { categoryId: bCategory.id })),
    ).rejects.toThrow(/Category not found/);

    const bVendor = await saveMaster(B.ctx, "vendors", null, vendor("Bravo Hotel"));
    await expect(
      saveMaster(A.ctx, "accommodations", null, {
        name: "Hotel X",
        cost: "100",
        vendorId: bVendor.id,
      }),
    ).rejects.toThrow(/Default vendor not found/);
  });

  it("links a tour item to the agency's own vendor", async () => {
    const v = await saveMaster(A.ctx, "vendors", null, vendor("Alpha Tours"));
    const { id } = await saveMaster(A.ctx, "guides", null, {
      name: "Guide Kamal",
      cost: "1500",
      vendorId: v.id,
    });
    const row = await getEntity(A.ctx, "guides", id);
    expect(row?.vendorId__label).toBe("Alpha Tours");
  });
});

describe("search", () => {
  it("finds by name, code or phone", async () => {
    const { id } = await saveMaster(
      A.ctx,
      "clients",
      null,
      client("Nusrat Jahan", { phone: "01711223344" }),
    );
    const code = (await getEntity(A.ctx, "clients", id))!.code as string;
    for (const q of ["nusrat", code, "01711223344"]) {
      expect((await searchEntityOptions(A.ctx, "clients", q)).map((o) => o.value)).toContain(id);
    }
  });
});
