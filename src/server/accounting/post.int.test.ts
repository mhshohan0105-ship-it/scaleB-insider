// Phase 3 acceptance: posting engine, reversal, numbering, opening balances,
// balance transfers and the "golden rule" (debits = credits, cache = ledger).
import { Prisma } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { checkLedgerIntegrity, isHealthy } from "@/server/accounting/balances";
import { backfillOpeningEntries } from "@/server/accounting/backfill";
import { systemAccounts } from "@/server/accounting/ledgers";
import { postEntry, repostSource, reverseEntry } from "@/server/accounting/post";
import {
  createMoneyAccount,
  updateMoneyAccount,
} from "@/server/services/accounts/moneyAccountService";
import {
  createBalanceTransfer,
  voidBalanceTransfer,
} from "@/server/services/accounts/transferService";
import { transactionHistory } from "@/server/services/accounts/transactionHistory";
import { getEntity, saveMaster } from "@/server/services/masters/masterService";
import { makeAgency } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>;
let B: Awaited<ReturnType<typeof makeAgency>>;
let cashId: string;
let clientId: string;
let acc: Record<"AR" | "SALES_AIR" | "CAPITAL" | "COGS_AIR" | "AP", string>;

const today = "2026-09-28";
const dec = (v: Prisma.Decimal | string | number | null | undefined) =>
  new Prisma.Decimal(v ?? 0).toFixed(2);

const moneyBalance = async (id: string) =>
  dec((await prisma.moneyAccount.findUniqueOrThrow({ where: { id } })).balance);
const clientBalance = async (id: string) =>
  dec((await prisma.client.findUniqueOrThrow({ where: { id } })).balance);

function tx<T>(
  fn: Parameters<ReturnType<typeof tenantDb>["$transaction"]>[0] extends (t: infer X) => unknown
    ? (t: X) => Promise<T>
    : never,
) {
  return tenantDb(A.agency.id).$transaction(fn as never) as Promise<T>;
}

beforeAll(async () => {
  A = await makeAgency("acct-a");
  B = await makeAgency("acct-b");
  cashId = (
    await tenantDb(A.agency.id).moneyAccount.findFirstOrThrow({ where: { name: "Cash in Hand" } })
  ).id;
  acc = await tenantDb(A.agency.id).$transaction((t) =>
    systemAccounts(t, ["AR", "SALES_AIR", "CAPITAL", "COGS_AIR", "AP"] as const),
  );
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Ledger Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
});

describe("postEntry", () => {
  it("writes a balanced entry and moves the cached money balance", async () => {
    const entry = await tx((t) =>
      postEntry(t, A.ctx, {
        date: today,
        sourceType: "MANUAL",
        narration: "Owner puts in capital",
        lines: [
          { moneyAccountId: cashId, debit: "100000" },
          { ledgerAccountId: acc.CAPITAL, credit: "100000" },
        ],
      }),
    );
    expect(entry.number).toMatch(/^JV-2026-\d{5}$/);
    const lines = await prisma.journalLine.findMany({ where: { entryId: entry.id } });
    expect(lines).toHaveLength(2);
    expect(dec(lines.reduce((s, l) => s.plus(l.debit), new Prisma.Decimal(0)))).toBe(
      dec(lines.reduce((s, l) => s.plus(l.credit), new Prisma.Decimal(0))),
    );
    expect(await moneyBalance(cashId)).toBe("100000.00");
  });

  it("rejects an unbalanced entry and writes nothing", async () => {
    const before = await prisma.journalEntry.count({ where: { agencyId: A.agency.id } });
    await expect(
      tx((t) =>
        postEntry(t, A.ctx, {
          date: today,
          sourceType: "MANUAL",
          narration: "Broken",
          lines: [
            { moneyAccountId: cashId, debit: "10" },
            { ledgerAccountId: acc.CAPITAL, credit: "9.99" },
          ],
        }),
      ),
    ).rejects.toThrow(/must equal/);
    expect(await prisma.journalEntry.count({ where: { agencyId: A.agency.id } })).toBe(before);
    expect(await moneyBalance(cashId)).toBe("100000.00");
  });

  it("tags a money account's ledger line with the account so its balance stays right", async () => {
    const cash = await prisma.moneyAccount.findUniqueOrThrow({ where: { id: cashId } });
    await tx((t) =>
      postEntry(t, A.ctx, {
        date: today,
        sourceType: "MANUAL",
        narration: "Posted by ledger id",
        lines: [
          { ledgerAccountId: cash.ledgerAccountId, debit: "50" },
          { ledgerAccountId: acc.CAPITAL, credit: "50" },
        ],
      }),
    );
    expect(await moneyBalance(cashId)).toBe("100050.00");
  });

  it("blocks dates in a closed period", async () => {
    await prisma.accountingPeriod.create({ data: { agencyId: A.agency.id, year: 2025, month: 1 } });
    await expect(
      tx((t) =>
        postEntry(t, A.ctx, {
          date: "2025-01-15",
          sourceType: "MANUAL",
          narration: "Back dated",
          lines: [
            { moneyAccountId: cashId, debit: "1" },
            { ledgerAccountId: acc.CAPITAL, credit: "1" },
          ],
        }),
      ),
    ).rejects.toThrow(/2025-01 is closed/);
  });

  it("rejects another agency's accounts and parties", async () => {
    const bCash = await tenantDb(B.agency.id).moneyAccount.findFirstOrThrow();
    const bClient = await saveMaster(B.ctx, "clients", null, {
      name: "B client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    });
    const bAR = (
      await prisma.ledgerAccount.findFirstOrThrow({
        where: { agencyId: B.agency.id, systemKey: "AR" },
      })
    ).id;
    const post = (lines: Parameters<typeof postEntry>[2]["lines"]) =>
      tx((t) => postEntry(t, A.ctx, { date: today, sourceType: "MANUAL", narration: "x", lines }));

    await expect(
      post([
        { moneyAccountId: bCash.id, debit: "1" },
        { ledgerAccountId: acc.CAPITAL, credit: "1" },
      ]),
    ).rejects.toThrow(/Money account not found/);
    await expect(
      post([
        { ledgerAccountId: bAR, debit: "1" },
        { ledgerAccountId: acc.CAPITAL, credit: "1" },
      ]),
    ).rejects.toThrow(/Ledger account not found/);
    await expect(
      post([
        { ledgerAccountId: acc.AR, debit: "1", partyType: "CLIENT", partyId: bClient.id },
        { ledgerAccountId: acc.CAPITAL, credit: "1" },
      ]),
    ).rejects.toThrow(/client not found/);
  });
});

describe("reversal", () => {
  it("restores every balance exactly and can happen only once", async () => {
    const cashBefore = await moneyBalance(cashId);
    const clientBefore = await clientBalance(clientId);

    // Cash sale on account, then partly collected: touches cash, AR (client) and sales.
    const entry = await tx((t) =>
      postEntry(t, A.ctx, {
        date: today,
        sourceType: "MANUAL",
        narration: "Sale",
        lines: [
          { ledgerAccountId: acc.AR, debit: "50000", partyType: "CLIENT", partyId: clientId },
          { ledgerAccountId: acc.SALES_AIR, credit: "50000" },
          { moneyAccountId: cashId, debit: "30000" },
          { ledgerAccountId: acc.AR, credit: "30000", partyType: "CLIENT", partyId: clientId },
        ],
      }),
    );
    expect(await clientBalance(clientId)).toBe(dec(new Prisma.Decimal(clientBefore).plus(20000)));
    expect(await moneyBalance(cashId)).toBe(dec(new Prisma.Decimal(cashBefore).plus(30000)));

    const reversal = await tx((t) => reverseEntry(t, A.ctx, entry.id));
    expect(reversal.isReversal).toBe(true);
    expect(await clientBalance(clientId)).toBe(clientBefore);
    expect(await moneyBalance(cashId)).toBe(cashBefore);

    // Original lines untouched.
    const original = await prisma.journalLine.findMany({ where: { entryId: entry.id } });
    expect(original.map((l) => dec(l.debit)).sort()).toEqual([
      "0.00",
      "0.00",
      "30000.00",
      "50000.00",
    ]);

    await expect(tx((t) => reverseEntry(t, A.ctx, entry.id))).rejects.toThrow(/already reversed/);
    await expect(tx((t) => reverseEntry(t, A.ctx, reversal.id))).rejects.toThrow(
      /cannot be reversed/,
    );
  });

  it("repostSource replaces a document's effect", async () => {
    const before = await clientBalance(clientId);
    const lines = (amount: string) => [
      { ledgerAccountId: acc.AR, debit: amount, partyType: "CLIENT" as const, partyId: clientId },
      { ledgerAccountId: acc.SALES_AIR, credit: amount },
    ];
    await tx((t) =>
      repostSource(t, A.ctx, "TEST_DOC", "doc-1", {
        date: today,
        narration: "v1",
        lines: lines("1000"),
      }),
    );
    await tx((t) =>
      repostSource(t, A.ctx, "TEST_DOC", "doc-1", {
        date: today,
        narration: "v2",
        lines: lines("1250"),
      }),
    );
    expect(await clientBalance(clientId)).toBe(dec(new Prisma.Decimal(before).plus(1250)));
    await tx((t) => repostSource(t, A.ctx, "TEST_DOC", "doc-1", null));
    expect(await clientBalance(clientId)).toBe(before);
  });
});

describe("numbering", () => {
  it("gives concurrent postings distinct, gap-free numbers", async () => {
    const C = await makeAgency("acct-c");
    const cash = await tenantDb(C.agency.id).moneyAccount.findFirstOrThrow();
    const capital = (
      await prisma.ledgerAccount.findFirstOrThrow({
        where: { agencyId: C.agency.id, systemKey: "CAPITAL" },
      })
    ).id;
    const entries = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        tenantDb(C.agency.id).$transaction((t) =>
          postEntry(t, C.ctx, {
            date: today,
            sourceType: "MANUAL",
            narration: `Concurrent ${i}`,
            lines: [
              { moneyAccountId: cash.id, debit: "1" },
              { ledgerAccountId: capital, credit: "1" },
            ],
          }),
        ),
      ),
    );
    const numbers = entries.map((e) => e.number).sort();
    expect(new Set(numbers).size).toBe(30);
    expect(numbers[0]).toBe("JV-2026-00001");
    expect(numbers[29]).toBe("JV-2026-00030");
    expect(await moneyBalance(cash.id)).toBe("30.00");
  });
});

describe("opening balances", () => {
  it("posts, reposts on edit and reverses when cleared", async () => {
    const input = (amount: string, type: "RECEIVABLE" | "PAYABLE") => ({
      name: "Opening Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: amount,
      openingBalanceType: type,
    });
    const { id } = await saveMaster(A.ctx, "clients", null, input("12500", "RECEIVABLE"));
    expect((await getEntity(A.ctx, "clients", id))?.balance).toBe("12500");

    await saveMaster(A.ctx, "clients", id, input("3000", "PAYABLE"));
    expect((await getEntity(A.ctx, "clients", id))?.balance).toBe("-3000");

    await saveMaster(A.ctx, "clients", id, input("0", "PAYABLE"));
    expect((await getEntity(A.ctx, "clients", id))?.balance).toBe("0");

    const entries = await prisma.journalEntry.findMany({
      where: { sourceType: "OPENING_BALANCE", sourceId: id },
    });
    expect(entries).toHaveLength(4); // post, reverse, post, reverse
    expect(entries.filter((e) => e.isReversal)).toHaveLength(2);
  });

  it("vendor payable goes to AP as a credit", async () => {
    const { id } = await saveMaster(A.ctx, "vendors", null, {
      name: "Opening Vendor",
      type: "OTHER",
      commissionPercent: "0",
      openingBalance: "47000",
      openingBalanceType: "PAYABLE",
    });
    const line = await prisma.journalLine.findFirstOrThrow({
      where: { partyType: "VENDOR", partyId: id },
    });
    expect(line.ledgerAccountId).toBe(acc.AP);
    expect(dec(line.credit)).toBe("47000.00");
    expect((await getEntity(A.ctx, "vendors", id))?.balance).toBe("-47000");
  });

  it("backfills Phase 2 parties once, without changing their balance", async () => {
    // A party as Phase 2 left it: cached balance = opening, no journal entry.
    const legacy = await prisma.client.create({
      data: {
        agencyId: A.agency.id,
        code: "CL-LEGACY",
        name: "Legacy Client",
        openingBalance: new Prisma.Decimal("800"),
        openingBalanceType: "RECEIVABLE",
        balance: new Prisma.Decimal("800"),
      },
    });
    expect(await backfillOpeningEntries(A.ctx)).toBe(1);
    expect(await clientBalance(legacy.id)).toBe("800.00");
    expect(await prisma.journalEntry.count({ where: { sourceId: legacy.id } })).toBe(1);
    expect(await backfillOpeningEntries(A.ctx)).toBe(0);
  });

  it("money account opening posts against Opening Balance Equity and reposts on edit", async () => {
    const { id } = await createMoneyAccount(A.ctx, {
      name: "Dutch-Bangla Bank",
      kind: "BANK",
      bankName: "DBBL",
      accountNo: "1234-5678-9012",
      openingBalance: "250000",
    });
    const account = await prisma.moneyAccount.findUniqueOrThrow({ where: { id } });
    expect(account.accountNoMasked).toBe("••••9012");
    expect(await moneyBalance(id)).toBe("250000.00");
    await updateMoneyAccount(A.ctx, id, {
      name: "DBBL Current",
      kind: "BANK",
      openingBalance: "200000",
    });
    expect(await moneyBalance(id)).toBe("200000.00");
    const ledger = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { id: account.ledgerAccountId },
    });
    expect(ledger.name).toBe("DBBL Current");
    expect((await prisma.moneyAccount.findUniqueOrThrow({ where: { id } })).accountNoMasked).toBe(
      "••••9012",
    );
  });
});

describe("balance transfer", () => {
  it("moves money, books the charge, and void puts it back", async () => {
    const bank = (
      await createMoneyAccount(A.ctx, { name: "City Bank", kind: "BANK", openingBalance: "50000" })
    ).id;
    const cashBefore = await moneyBalance(cashId);

    const t = await createBalanceTransfer(A.ctx, {
      date: today,
      fromAccountId: bank,
      toAccountId: cashId,
      amount: "10000",
      charge: "25",
      note: "Petty cash",
    });
    expect(t.number).toMatch(/^BT-2026-\d{5}$/);
    expect(await moneyBalance(bank)).toBe("39975.00");
    expect(await moneyBalance(cashId)).toBe(dec(new Prisma.Decimal(cashBefore).plus(10000)));

    const history = await transactionHistory(A.ctx, {
      page: 1,
      pageSize: 10,
      moneyAccountId: bank,
    });
    // The account's opening is dated the day the test runs, so find the transfer's row.
    expect(history.rows.find((r) => r.sourceType === "BALANCE_TRANSFER")).toMatchObject({
      moneyOut: "10025.00",
    });

    await voidBalanceTransfer(A.ctx, t.id, { reason: "Entered twice" });
    expect(await moneyBalance(bank)).toBe("50000.00");
    expect(await moneyBalance(cashId)).toBe(cashBefore);
    await expect(voidBalanceTransfer(A.ctx, t.id, { reason: "again" })).rejects.toThrow(
      /already void/,
    );
    const row = await prisma.balanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
    expect(row).toMatchObject({ status: "VOID", voidReason: "Entered twice" });
  });

  it("does not let cash go negative", async () => {
    const wallet = (
      await createMoneyAccount(A.ctx, {
        name: "bKash",
        kind: "MOBILE_BANKING",
        openingBalance: "100",
      })
    ).id;
    await expect(
      createBalanceTransfer(A.ctx, {
        date: today,
        fromAccountId: wallet,
        toAccountId: cashId,
        amount: "100",
        charge: "1",
      }),
    ).rejects.toThrow(/available/);
    expect(await moneyBalance(wallet)).toBe("100.00");
  });

  it("rejects same-account transfers and other agencies' accounts", async () => {
    await expect(
      createBalanceTransfer(A.ctx, {
        date: today,
        fromAccountId: cashId,
        toAccountId: cashId,
        amount: "1",
      }),
    ).rejects.toThrow();
    const bCash = await tenantDb(B.agency.id).moneyAccount.findFirstOrThrow();
    await expect(
      createBalanceTransfer(A.ctx, {
        date: today,
        fromAccountId: cashId,
        toAccountId: bCash.id,
        amount: "1",
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("golden rule", () => {
  it("every agency's ledger balances and every cached balance matches it", async () => {
    for (const agency of [A, B]) {
      const integrity = await checkLedgerIntegrity(tenantDb(agency.agency.id), agency.agency.id);
      expect(integrity.drift).toEqual([]);
      expect(integrity.unbalancedEntries).toEqual([]);
      expect(integrity.totalDebit).toBe(integrity.totalCredit);
      expect(isHealthy(integrity)).toBe(true);
    }
  });
});
