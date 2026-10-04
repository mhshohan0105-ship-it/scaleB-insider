// Dashboard figures (PLAN.md section 9). Everything is aggregated in SQL so
// it stays fast as data grows; raw queries bind agencyId explicitly.
import { Prisma } from "@prisma/client";
import { dateToIso, fiscalMonths, fiscalYear, isoToDate, monthStart, todayIso } from "@/lib/dates";
import { checkLedgerIntegrity, isHealthy } from "@/server/accounting/balances";
import { sqlDate } from "@/server/db/sqlDate";
import { passportAlerts } from "../passports/passportService";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { listMoneyAccounts } from "../accounts/moneyAccountService";
import { ledgerSums, natural } from "@/server/reports/ledgerSums";
import { getAppConfig } from "../settings/settingsService";

// Posted invoices, including refunded ones (their refunds are netted below).
const LIVE = Prisma.sql`('POSTED', 'PARTIAL', 'PAID', 'REFUNDED')`;
const LIVE_STATUSES = ["POSTED", "PARTIAL", "PAID", "REFUNDED"] as const;
const z = () => new Prisma.Decimal(0);
const money = (v: Prisma.Decimal | null | undefined) => new Prisma.Decimal(v ?? 0).toFixed(2);

export interface PeriodFigures {
  today: string;
  month: string;
  year: string;
}

export interface Dashboard {
  today: string;
  fiscalYearLabel: string;
  sales: PeriodFigures;
  collection: PeriodFigures;
  discount: PeriodFigures;
  receivable: string;
  payable: string;
  clientAdvance: string;
  chart: { month: string; sales: string; purchase: string; collection: string; profit: string }[];
  flights: {
    id: string;
    invoiceId: string;
    invoiceType: string;
    journeyDate: string;
    passengerName: string;
    route: string;
    airline: string;
    pnr: string | null;
    clientName: string;
  }[];
  accounts: { id: string; name: string; kind: string; balance: string }[];
  accountsTotal: string;
  bestClients: { month: RankRow[]; year: RankRow[] };
  bestSalesmen: { month: RankRow[]; year: RankRow[] };
  expenses: { name: string; amount: string }[];
  ledgerHealthy: boolean | null;
  alerts: {
    passports: Awaited<ReturnType<typeof passportAlerts>>;
    visas: { status: string; count: number }[];
    cheques: { direction: "RECEIVED" | "ISSUED"; count: number; amount: string }[];
  };
}

export interface RankRow {
  id: string;
  name: string;
  amount: string;
  count: number;
}

export async function getDashboard(
  ctx: ServiceContext,
  opts: { checkLedger: boolean },
): Promise<Dashboard> {
  const db = tenantDb(ctx.agencyId);
  const today = todayIso();
  const config = await getAppConfig(ctx);
  const fy = fiscalYear(today, config.fiscalYearStart);
  const m0 = monthStart(today);
  const t = sqlDate(today);
  const d = (iso: string) => sqlDate(iso);

  // Sales, discount and collection for today / this month / this fiscal year in one pass each.
  const [[sales], [collection]] = await Promise.all([
    db.$queryRaw<
      {
        st: Prisma.Decimal;
        sm: Prisma.Decimal;
        sy: Prisma.Decimal;
        dt: Prisma.Decimal;
        dm: Prisma.Decimal;
        dy: Prisma.Decimal;
      }[]
    >`
      SELECT
        COALESCE(SUM("netTotal" - "refundCredit") FILTER (WHERE date = ${t}), 0) AS st,
        COALESCE(SUM("netTotal" - "refundCredit") FILTER (WHERE date >= ${d(m0)}), 0) AS sm,
        COALESCE(SUM("netTotal" - "refundCredit"), 0) AS sy,
        COALESCE(SUM(discount) FILTER (WHERE date = ${t}), 0) AS dt,
        COALESCE(SUM(discount) FILTER (WHERE date >= ${d(m0)}), 0) AS dm,
        COALESCE(SUM(discount), 0) AS dy
      FROM "Invoice"
      WHERE "agencyId" = ${ctx.agencyId} AND status::text IN ${LIVE}
        AND date >= ${d(fy.from)} AND date <= ${t}`,
    db.$queryRaw<{ ct: Prisma.Decimal; cm: Prisma.Decimal; cy: Prisma.Decimal }[]>`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE date = ${t}), 0) AS ct,
        COALESCE(SUM(amount) FILTER (WHERE date >= ${d(m0)}), 0) AS cm,
        COALESCE(SUM(amount), 0) AS cy
      FROM "MoneyReceipt"
      WHERE "agencyId" = ${ctx.agencyId} AND status = 'POSTED'
        AND date >= ${d(fy.from)} AND date <= ${t}`,
  ]);

  // Receivable / payable from cached party balances (kept equal to the ledger).
  const [clientDue, clientAdv, vendorPay, vendorAdv, combined] = await Promise.all([
    db.client.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true } }),
    db.client.aggregate({ where: { balance: { lt: 0 } }, _sum: { balance: true } }),
    db.vendor.aggregate({ where: { balance: { lt: 0 } }, _sum: { balance: true } }),
    db.vendor.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true } }),
    Promise.all([
      db.combinedClient.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true } }),
      db.combinedClient.aggregate({ where: { balance: { lt: 0 } }, _sum: { balance: true } }),
    ]),
  ]);
  const receivable = (clientDue._sum.balance ?? z())
    .plus(vendorAdv._sum.balance ?? z())
    .plus(combined[0]._sum.balance ?? z());
  const payable = (vendorPay._sum.balance ?? z()).plus(combined[1]._sum.balance ?? z()).negated();
  const clientAdvance = (clientAdv._sum.balance ?? z()).negated();

  // Monthly chart for the fiscal year.
  const [invMonths, recMonths] = await Promise.all([
    db.$queryRaw<
      { m: string; sales: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal }[]
    >`
      SELECT to_char(date, 'YYYY-MM') AS m,
             SUM("netTotal" - "refundCredit") AS sales,
             SUM("totalCost" - "refundCost") AS cost,
             SUM(profit - "refundCredit" + "refundCost") AS profit
      FROM "Invoice"
      WHERE "agencyId" = ${ctx.agencyId} AND status::text IN ${LIVE}
        AND date >= ${d(fy.from)} AND date <= ${d(fy.to)}
      GROUP BY m`,
    db.$queryRaw<{ m: string; amount: Prisma.Decimal }[]>`
      SELECT to_char(date, 'YYYY-MM') AS m, SUM(amount) AS amount
      FROM "MoneyReceipt"
      WHERE "agencyId" = ${ctx.agencyId} AND status = 'POSTED'
        AND date >= ${d(fy.from)} AND date <= ${d(fy.to)}
      GROUP BY m`,
  ]);
  const inv = new Map(invMonths.map((r) => [r.m, r]));
  const rec = new Map(recMonths.map((r) => [r.m, r.amount]));
  const chart = fiscalMonths(fy.from).map((m) => ({
    month: m,
    sales: money(inv.get(m)?.sales),
    purchase: money(inv.get(m)?.cost),
    collection: money(rec.get(m)),
    profit: money(inv.get(m)?.profit),
  }));

  // Flights in the next 7 days.
  const now = isoToDate(today);
  const week = new Date(now.getTime() + 7 * 86_400_000);
  // A reissued ticket flies on its reissue's date, so it is listed from there.
  const liveInvoice = { status: { in: [...LIVE_STATUSES].filter((x) => x !== "REFUNDED") } };
  const flightInclude = {
    airline: { select: { iata: true } },
    invoice: { select: { id: true, type: true, client: { select: { name: true } } } },
  } as const;
  const [ticketFlights, reissueFlights] = await Promise.all([
    db.invoiceAirTicket.findMany({
      where: {
        journeyDate: { gte: now, lte: week },
        invoice: liveInvoice,
        reissues: { none: { invoice: liveInvoice } },
      },
      include: flightInclude,
      orderBy: [{ journeyDate: "asc" }, { passengerName: "asc" }],
      take: 25,
    }),
    db.invoiceReissueLine.findMany({
      where: { journeyDate: { gte: now, lte: week }, invoice: liveInvoice },
      include: flightInclude,
      orderBy: [{ journeyDate: "asc" }, { passengerName: "asc" }],
      take: 25,
    }),
  ]);
  const flights = [...ticketFlights, ...reissueFlights]
    .sort(
      (a, b) =>
        a.journeyDate.getTime() - b.journeyDate.getTime() ||
        a.passengerName.localeCompare(b.passengerName),
    )
    .slice(0, 25);

  // Best clients and salesmen, this month and this fiscal year.
  const rank = async (field: "clientId" | "salesmanId", from: string) => {
    const rows = await db.invoice.groupBy({
      by: [field],
      where: {
        status: { in: ["POSTED", "PARTIAL", "PAID"] },
        date: { gte: isoToDate(from), lte: now },
        ...(field === "salesmanId" ? { salesmanId: { not: null } } : {}),
      },
      _sum: { netTotal: true, refundCredit: true },
      _count: { _all: true },
      orderBy: { _sum: { netTotal: "desc" } },
      take: 5,
    });
    const ids = rows.map((r) => r[field]).filter((x): x is string => !!x);
    const names =
      field === "clientId"
        ? await db.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
        : await db.employee.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          });
    const nameOf = new Map(names.map((n) => [n.id, n.name]));
    return rows.map((r) => ({
      id: r[field] as string,
      name: nameOf.get(r[field] as string) ?? "-",
      amount: money((r._sum.netTotal ?? z()).minus(r._sum.refundCredit ?? z())),
      count: r._count._all,
    }));
  };
  const [clientsMonth, clientsYear, salesMonth, salesYear] = await Promise.all([
    rank("clientId", m0),
    rank("clientId", fy.from),
    rank("salesmanId", m0),
    rank("salesmanId", fy.from),
  ]);

  // Operating expenses this fiscal year (cost of sales excluded).
  const sums = await ledgerSums(ctx, { from: fy.from, to: today });
  const expenses = sums
    .filter(
      (a) => a.type === "EXPENSE" && !a.systemKey?.startsWith("COGS_") && natural(a).greaterThan(0),
    )
    .map((a) => ({ name: a.name, amount: natural(a).toFixed(2) }))
    .sort((a, b) => new Prisma.Decimal(b.amount).comparedTo(a.amount));

  const accounts = await listMoneyAccounts(ctx, { activeOnly: true });
  const ledgerHealthy = opts.checkLedger
    ? isHealthy(await checkLedgerIntegrity(db, ctx.agencyId))
    : null;

  // Alerts: passports expiring, visas still in process, cheques not cleared.
  const [passports, visaGroups, chequeGroups] = await Promise.all([
    passportAlerts(ctx, today),
    db.invoiceVisaLine.groupBy({
      by: ["status"],
      where: {
        status: { in: ["PENDING", "SUBMITTED", "APPROVED"] },
        invoice: { status: { in: ["POSTED", "PARTIAL", "PAID"] } },
      },
      _count: { _all: true },
    }),
    db.cheque.groupBy({
      by: ["direction"],
      where: { status: { in: ["PENDING", "DEPOSITED"] } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);
  const alerts = {
    passports,
    visas: visaGroups.map((g) => ({ status: g.status as string, count: g._count._all })),
    cheques: chequeGroups.map((g) => ({
      direction: g.direction,
      count: g._count._all,
      amount: money(g._sum.amount),
    })),
  };

  return {
    alerts,
    today,
    fiscalYearLabel: fy.label,
    sales: { today: money(sales?.st), month: money(sales?.sm), year: money(sales?.sy) },
    discount: { today: money(sales?.dt), month: money(sales?.dm), year: money(sales?.dy) },
    collection: {
      today: money(collection?.ct),
      month: money(collection?.cm),
      year: money(collection?.cy),
    },
    receivable: money(receivable),
    payable: money(payable),
    clientAdvance: money(clientAdvance),
    chart,
    flights: flights.map((f) => ({
      id: f.id,
      invoiceId: f.invoice.id,
      invoiceType: f.invoice.type as string,
      journeyDate: dateToIso(f.journeyDate),
      passengerName: f.passengerName,
      route: f.route,
      airline: f.airline.iata,
      pnr: f.pnr,
      clientName: f.invoice.client.name,
    })),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: a.balance })),
    accountsTotal: money(accounts.reduce((s, a) => s.plus(a.balance), z())),
    bestClients: { month: clientsMonth, year: clientsYear },
    bestSalesmen: { month: salesMonth, year: salesYear },
    expenses,
    ledgerHealthy,
  };
}
