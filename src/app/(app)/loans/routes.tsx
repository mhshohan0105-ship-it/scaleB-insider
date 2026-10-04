import "server-only";
// Page renderers for Loan & Investments (module "loan").
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import {
  AuthoritiesPage,
  LoanDetail,
  LoanPaymentsPage,
  LoansPage,
} from "@/components/loans/LoanPages";
import { todayIso } from "@/lib/dates";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import {
  activeLoanOptions,
  getLoan,
  listLoanAuthorities,
  listLoanPayments,
  listLoans,
  loanAuthorityOptions,
} from "@/server/services/loans/loanService";
import type { RawSearchParams } from "../loadEntityPage";

async function access() {
  const user = await getUserContext();
  const p = (a: "view" | "create" | "edit" | "void") => can(user.permissions, "loan", a);
  return { allowed: p("view"), p, ctx: await toServiceContext(user) };
}

const accountOptions = async (ctx: Awaited<ReturnType<typeof access>>["ctx"]) =>
  (await listMoneyAccounts(ctx, { activeOnly: true })).map((a) => ({ value: a.id, label: a.name }));

export async function renderAuthorities() {
  const a = await access();
  if (!a.allowed) return <AccessDenied />;
  return (
    <AuthoritiesPage
      rows={await listLoanAuthorities(a.ctx)}
      canCreate={a.p("create")}
      canEdit={a.p("edit")}
    />
  );
}

export async function renderLoans(
  kind: "LOANS" | "INVESTMENT",
  searchParams: Promise<RawSearchParams>,
) {
  const a = await access();
  if (!a.allowed) return <AccessDenied />;
  const params = parseListParams(await searchParams);
  const kinds = kind === "LOANS" ? (["TAKEN", "GIVEN"] as const) : (["INVESTMENT"] as const);
  const [data, authorities, accounts] = await Promise.all([
    listLoans(a.ctx, kinds, params),
    loanAuthorityOptions(a.ctx),
    accountOptions(a.ctx),
  ]);
  return (
    <LoansPage
      kinds={[...kinds]}
      title={kind === "LOANS" ? "Loan Information" : "Received Investments"}
      description={
        kind === "LOANS"
          ? "Loans the agency takes from banks or people, and loans it gives."
          : "Money invested in the agency by partners or investors, repaid with a share of profit as interest."
      }
      data={data}
      params={params}
      authorities={authorities}
      accounts={accounts}
      canCreate={a.p("create")}
      canVoid={a.p("void")}
      today={todayIso()}
    />
  );
}

export async function renderLoan(id: string) {
  const a = await access();
  if (!a.allowed) return <AccessDenied />;
  const loan = await getLoan(a.ctx, id);
  if (!loan) notFound();
  return <LoanDetail loan={loan} canPay={a.p("create")} canVoid={a.p("void")} />;
}

export async function renderLoanPayments(searchParams: Promise<RawSearchParams>) {
  const a = await access();
  if (!a.allowed) return <AccessDenied />;
  const raw = await searchParams;
  const params = parseListParams(raw);
  const [data, loans, accounts] = await Promise.all([
    listLoanPayments(a.ctx, params),
    activeLoanOptions(a.ctx),
    accountOptions(a.ctx),
  ]);
  const wanted = firstParam(raw.loan);
  return (
    <LoanPaymentsPage
      data={data}
      params={params}
      loans={loans}
      accounts={accounts}
      initialLoanId={loans.some((l) => l.value === wanted) ? wanted : undefined}
      canCreate={a.p("create")}
      canVoid={a.p("void")}
      today={todayIso()}
    />
  );
}
