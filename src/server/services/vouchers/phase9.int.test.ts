// Phase 9: expense, other income, agent payment, employee advance and
// payroll, bill adjustment, investments, loans and cheques.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { checkLedgerIntegrity } from "@/server/accounting/balances";
import { saveMaster } from "@/server/services/masters/masterService";
import {
  chartOfAccounts,
  createMoneyAccount,
} from "@/server/services/accounts/moneyAccountService";
import { saveExpenseHead } from "@/server/services/expense/expenseHeadService";
import {
  createLoan,
  createLoanPayment,
  getLoan,
  saveLoanAuthority,
  voidLoanPayment,
} from "@/server/services/loans/loanService";
import {
  createPayroll,
  payrollDefaults,
  voidPayroll,
} from "@/server/services/payroll/payrollService";
import { createMoneyReceipt, voidMoneyReceipt } from "@/server/services/payments/receiptService";
import { createVendorPayment } from "@/server/services/payments/vendorPaymentService";
import {
  bounceCheque,
  clearCheque,
  depositCheque,
  listCheques,
} from "@/server/services/cheques/chequeService";
import { makeAgency } from "@/tests/integration/helpers";
import { createVoucher, listVouchers, voidVoucher } from "./voucherService";

let A: Awaited<ReturnType<typeof makeAgency>>;
let cash: string;
let bank: string;
let clientId: string;
let vendorId: string;
let agentId: string;
let employeeId: string;
const day = "2026-09-29";

const bal = async (id: string) =>
  (await prisma.moneyAccount.findUniqueOrThrow({ where: { id } })).balance.toFixed(2);
const party = async (model: "client" | "vendor" | "agent" | "loanAuthority", id: string) => {
  const where = { where: { id } };
  const row =
    model === "client"
      ? await prisma.client.findUniqueOrThrow(where)
      : model === "vendor"
        ? await prisma.vendor.findUniqueOrThrow(where)
        : model === "agent"
          ? await prisma.agent.findUniqueOrThrow(where)
          : await prisma.loanAuthority.findUniqueOrThrow(where);
  return row.balance.toFixed(2);
};
const chart = async () => new Map((await chartOfAccounts(A.ctx)).map((l) => [l.name, l.balance]));

beforeAll(async () => {
  A = await makeAgency("ph9");
  cash = (await createMoneyAccount(A.ctx, { name: "Desk", kind: "CASH", openingBalance: "100000" }))
    .id;
  bank = (
    await createMoneyAccount(A.ctx, { name: "City Bank", kind: "BANK", openingBalance: "50000" })
  ).id;
  const opening = { openingBalance: "0", openingBalanceType: "RECEIVABLE" };
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "P9 Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      ...opening,
    })
  ).id;
  vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "P9 Airline",
      type: "OTHER",
      commissionPercent: "0",
      ...opening,
      openingBalanceType: "PAYABLE",
    })
  ).id;
  agentId = (
    await saveMaster(A.ctx, "agents", null, {
      name: "P9 Agent",
      commissionPercent: "0",
      openingBalance: "2000",
      openingBalanceType: "PAYABLE",
    })
  ).id;
  employeeId = (
    await saveMaster(A.ctx, "employees", null, {
      name: "P9 Staff",
      salary: "20000",
      commissionPercent: "0",
    })
  ).id;
});

describe("expense", () => {
  it("books to the head's own ledger and can be voided", async () => {
    const { id: rent } = await saveExpenseHead(A.ctx, null, { name: "Office Rent" });
    await expect(saveExpenseHead(A.ctx, null, { name: "Office Rent" })).rejects.toThrow(/exists/);
    const e = await createVoucher(A.ctx, "EXPENSE", {
      date: day,
      amount: "5000",
      expenseHeadId: rent,
      moneyAccountId: cash,
    });
    expect(e.number).toMatch(/^EXP-2026-\d{5}$/);
    expect(await bal(cash)).toBe("95000.00");
    expect((await chart()).get("Expense - Office Rent")).toBe("5000.00");
    await expect(
      createVoucher(A.ctx, "EXPENSE", {
        date: day,
        amount: "999999",
        expenseHeadId: rent,
        moneyAccountId: cash,
      }),
    ).rejects.toThrow(/available/);
    await voidVoucher(A.ctx, e.id, { reason: "Wrong month" });
    expect(await bal(cash)).toBe("100000.00");
    const list = await listVouchers(A.ctx, ["EXPENSE"], { page: 1, pageSize: 20 } as never);
    expect(list.rows[0]).toMatchObject({ status: "VOID", expenseHead: "Office Rent" });
    expect(list.totals.amount).toBe("0.00");
  });
});

describe("other income, agent payment, bill adjustment", () => {
  it("incentive in cash or kept by the vendor", async () => {
    await createVoucher(A.ctx, "NON_INVOICE_INCOME", {
      date: day,
      amount: "1200",
      moneyAccountId: cash,
    });
    await createVoucher(A.ctx, "INCENTIVE_INCOME", {
      date: day,
      amount: "3000",
      partyId: vendorId,
      moneyAccountId: bank,
    });
    await createVoucher(A.ctx, "INCENTIVE_INCOME", { date: day, amount: "700", partyId: vendorId });
    expect(await bal(cash)).toBe("101200.00");
    expect(await bal(bank)).toBe("53000.00");
    expect(await party("vendor", vendorId)).toBe("700.00"); // vendor now owes us 700
    const c = await chart();
    expect(c.get("Non Invoice Income")).toBe("1200.00");
    expect(c.get("Incentive Income")).toBe("3700.00");
  });

  it("agent payment is limited to what the agent is owed", async () => {
    await createVoucher(A.ctx, "AGENT_PAYMENT", {
      date: day,
      amount: "1500",
      partyId: agentId,
      moneyAccountId: cash,
    });
    expect(await party("agent", agentId)).toBe("-500.00");
    await expect(
      createVoucher(A.ctx, "AGENT_PAYMENT", {
        date: day,
        amount: "600",
        partyId: agentId,
        moneyAccountId: cash,
      }),
    ).rejects.toThrow(/owed only 500.00/);
  });

  it("bill adjustment needs a reason and moves the due", async () => {
    const input = {
      date: day,
      amount: "300",
      partyType: "CLIENT",
      partyId: clientId,
      direction: "INCREASE_DUE",
    };
    await expect(createVoucher(A.ctx, "BILL_ADJUSTMENT", input)).rejects.toThrow(/reason/);
    await createVoucher(A.ctx, "BILL_ADJUSTMENT", { ...input, note: "Missed service charge" });
    expect(await party("client", clientId)).toBe("300.00");
    expect((await chart()).get("Bill Adjustments")).toBe("-300.00");
  });
});

describe("employee advance and payroll", () => {
  it("recovers the advance from the salary; one payroll per month", async () => {
    await createVoucher(A.ctx, "EMPLOYEE_ADVANCE", {
      date: day,
      amount: "5000",
      partyId: employeeId,
      moneyAccountId: cash,
    });
    expect(await payrollDefaults(A.ctx, employeeId)).toEqual({
      salary: "20000.00",
      advanceOutstanding: "5000.00",
    });
    const cashBefore = Number(await bal(cash));
    const p = await createPayroll(A.ctx, {
      employeeId,
      month: "2026-09",
      date: day,
      basic: "20000",
      allowances: [{ name: "House", amount: "2000" }],
      deductions: [{ name: "Absence", amount: "500" }],
      advanceAdjusted: "3000",
      moneyAccountId: cash,
    });
    expect(p.number).toMatch(/^PAY-2026-\d{5}$/);
    expect(await bal(cash)).toBe((cashBefore - 18500).toFixed(2));
    expect((await chart()).get("Salaries")).toBe("21500.00");
    expect((await payrollDefaults(A.ctx, employeeId))!.advanceOutstanding).toBe("2000.00");
    await expect(
      createPayroll(A.ctx, {
        employeeId,
        month: "2026-09",
        date: day,
        basic: "1",
        moneyAccountId: cash,
      }),
    ).rejects.toThrow(/already paid/);
    await expect(
      createPayroll(A.ctx, {
        employeeId,
        month: "2026-10",
        date: day,
        basic: "20000",
        advanceAdjusted: "2500",
        moneyAccountId: cash,
      }),
    ).rejects.toThrow(/Only 2000.00 of advance/);
    await voidPayroll(A.ctx, p.id, { reason: "Recalculate" });
    expect((await payrollDefaults(A.ctx, employeeId))!.advanceOutstanding).toBe("5000.00");
  });
});

describe("investments", () => {
  it("return with gain; cannot return more than invested", async () => {
    const inv = await createVoucher(A.ctx, "INVESTMENT", {
      date: day,
      amount: "50000",
      title: "FDR",
      moneyAccountId: bank,
    });
    const before = Number(await bal(bank));
    await createVoucher(A.ctx, "INVESTMENT_RETURN", {
      date: day,
      amount: "30000",
      profit: "2000",
      investmentId: inv.id,
      moneyAccountId: bank,
    });
    expect(await bal(bank)).toBe((before + 32000).toFixed(2));
    await expect(
      createVoucher(A.ctx, "INVESTMENT_RETURN", {
        date: day,
        amount: "25000",
        investmentId: inv.id,
        moneyAccountId: bank,
      }),
    ).rejects.toThrow(/Only 20000.00/);
    await expect(voidVoucher(A.ctx, inv.id, { reason: "test" })).rejects.toThrow(/returns/);
    expect((await chart()).get("Investments")).toBe("20000.00");
  });
});

describe("loans", () => {
  it("taken: money in, installments with interest, void payment", async () => {
    const { id: lender } = await saveLoanAuthority(A.ctx, null, {
      name: "Sonali Bank",
      type: "BANK",
    });
    const cashBefore = Number(await bal(cash));
    const loan = await createLoan(A.ctx, {
      kind: "TAKEN",
      authorityId: lender,
      date: day,
      principal: "100000",
      interestRate: "12",
      termMonths: 12,
      moneyAccountId: cash,
    });
    expect(await bal(cash)).toBe((cashBefore + 100000).toFixed(2));
    expect(await party("loanAuthority", lender)).toBe("-100000.00");
    const pay = await createLoanPayment(A.ctx, {
      loanId: loan.id,
      date: day,
      principal: "10000",
      interest: "1000",
      moneyAccountId: cash,
    });
    expect(await party("loanAuthority", lender)).toBe("-90000.00");
    expect((await chart()).get("Interest Expense")).toBe("1000.00");
    await expect(
      createLoanPayment(A.ctx, {
        loanId: loan.id,
        date: day,
        principal: "95000",
        moneyAccountId: cash,
      }),
    ).rejects.toThrow(/Only 90000.00/);
    const view = (await getLoan(A.ctx, loan.id))!;
    expect(view.schedule).toHaveLength(12);
    expect(view.outstanding).toBe("90000.00");
    await voidLoanPayment(A.ctx, pay.id, { reason: "Duplicate" });
    expect((await getLoan(A.ctx, loan.id))!.outstanding).toBe("100000.00");
  });

  it("given: repaid in full closes the loan", async () => {
    const { id: borrower } = await saveLoanAuthority(A.ctx, null, {
      name: "Partner Agency",
      type: "COMPANY",
    });
    const loan = await createLoan(A.ctx, {
      kind: "GIVEN",
      authorityId: borrower,
      date: day,
      principal: "20000",
      moneyAccountId: bank,
    });
    expect(await party("loanAuthority", borrower)).toBe("20000.00");
    await createLoanPayment(A.ctx, {
      loanId: loan.id,
      date: day,
      principal: "20000",
      interest: "500",
      moneyAccountId: bank,
    });
    const view = (await getLoan(A.ctx, loan.id))!;
    expect(view.status).toBe("CLOSED");
    expect(await party("loanAuthority", borrower)).toBe("0.00");
    expect((await chart()).get("Interest Income")).toBe("2500.00"); // 2,000 investment gain + 500
  });
});

describe("cheques", () => {
  const cheque = (no: string) => ({ chequeNo: no, bankName: "Dutch Bangla", chequeDate: day });

  it("received cheque sits in Cheques in Hand until it clears; bounce voids the receipt", async () => {
    const bankBefore = Number(await bal(bank));
    const clientBefore = Number(await party("client", clientId));
    await createMoneyReceipt(A.ctx, {
      clientId,
      date: day,
      moneyAccountId: bank,
      paymentMethod: "CHEQUE",
      amount: "10000",
      cheque: cheque("CQ-1"),
    });
    await createMoneyReceipt(A.ctx, {
      clientId,
      date: day,
      moneyAccountId: bank,
      paymentMethod: "CHEQUE",
      amount: "4000",
      cheque: cheque("CQ-2"),
    });
    await expect(
      createMoneyReceipt(A.ctx, {
        clientId,
        date: day,
        moneyAccountId: bank,
        paymentMethod: "CHEQUE",
        amount: "1",
      }),
    ).rejects.toThrow();
    expect(await bal(bank)).toBe(bankBefore.toFixed(2));
    expect((await chart()).get("Cheques in Hand")).toBe("14000.00");

    const list = await listCheques(A.ctx, {
      page: 1,
      pageSize: 20,
      direction: "RECEIVED",
    } as never);
    const c1 = list.rows.find((r) => r.chequeNo === "CQ-1")!;
    const c2 = list.rows.find((r) => r.chequeNo === "CQ-2")!;
    await depositCheque(A.ctx, c1.id, { date: day });
    await clearCheque(A.ctx, c1.id, { date: day });
    expect(await bal(bank)).toBe((bankBefore + 10000).toFixed(2));
    await expect(clearCheque(A.ctx, c1.id, { date: day })).rejects.toThrow(/cleared/);
    await expect(voidMoneyReceipt(A.ctx, c1.document!.id, { reason: "test" })).rejects.toThrow(
      /cleared/,
    );

    await bounceCheque(A.ctx, c2.id, { date: day, note: "Insufficient funds" });
    expect((await chart()).get("Cheques in Hand")).toBe("0.00");
    expect(await party("client", clientId)).toBe((clientBefore - 10000).toFixed(2));
    const after = await listCheques(A.ctx, {
      page: 1,
      pageSize: 20,
      chequeStatus: "BOUNCED",
    } as never);
    expect(after.rows.map((r) => r.chequeNo)).toEqual(["CQ-2"]);
  });

  it("issued cheque takes the money when it clears", async () => {
    const bankBefore = Number(await bal(bank));
    await createVendorPayment(A.ctx, {
      vendorId,
      date: day,
      moneyAccountId: bank,
      paymentMethod: "CHEQUE",
      amount: "8000",
      cheque: cheque("OUT-1"),
    });
    expect(await bal(bank)).toBe(bankBefore.toFixed(2));
    expect((await chart()).get("Cheques Issued (not cleared)")).toBe("8000.00");
    const c = (await listCheques(A.ctx, { page: 1, pageSize: 20, direction: "ISSUED" } as never))
      .rows[0]!;
    await expect(depositCheque(A.ctx, c.id, { date: day })).rejects.toThrow(/received/);
    await clearCheque(A.ctx, c.id, { date: day });
    expect(await bal(bank)).toBe((bankBefore - 8000).toFixed(2));
    expect((await chart()).get("Cheques Issued (not cleared)")).toBe("0.00");
  });

  it("keeps the ledger balanced", async () => {
    const integrity = await checkLedgerIntegrity(tenantDb(A.agency.id), A.agency.id);
    expect(integrity.drift).toEqual([]);
    expect(integrity.unbalancedEntries).toEqual([]);
    expect(integrity.totalDebit).toBe(integrity.totalCredit);
  });
});
