import "server-only";
// Page renderer for every voucher page (expense, other income, agent
// payment, employee advance, bill adjustment, investments).
import type { VoucherKind } from "@prisma/client";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { VoucherPage } from "@/components/vouchers/VoucherPage";
import { todayIso } from "@/lib/dates";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import type { VoucherKindKey } from "@/lib/schemas/money";
import { VOUCHER_KIND_INFO } from "@/lib/voucherKinds";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { expenseHeadOptions } from "@/server/services/expense/expenseHeadService";
import { masterOptions } from "@/server/services/masters/masterService";
import { listVouchers, openInvestments } from "@/server/services/vouchers/voucherService";
import type { RawSearchParams } from "../loadEntityPage";

export async function renderVoucherPage(
  kind: VoucherKindKey,
  searchParams: Promise<RawSearchParams>,
  opts: { title?: string; description?: string; withForm?: boolean; afterSave?: string } = {},
) {
  const info = VOUCHER_KIND_INFO[kind];
  const user = await getUserContext();
  if (!can(user.permissions, info.module, "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const raw = await searchParams;
  const params = parseListParams(raw);
  const kinds: VoucherKind[] = kind === "INVESTMENT" ? ["INVESTMENT", "INVESTMENT_RETURN"] : [kind];
  const [data, accounts, expenseHeads, employees, investments] = await Promise.all([
    listVouchers(ctx, kinds, {
      ...params,
      expenseHeadId: firstParam(raw.expenseHeadId) || undefined,
    }),
    listMoneyAccounts(ctx, { activeOnly: true }),
    kind === "EXPENSE" ? expenseHeadOptions(ctx) : Promise.resolve(undefined),
    kind === "EMPLOYEE_ADVANCE" ? masterOptions(ctx, "employees") : Promise.resolve(undefined),
    kind === "INVESTMENT" ? openInvestments(ctx) : Promise.resolve(undefined),
  ]);
  return (
    <VoucherPage
      kind={kind}
      title={opts.title}
      description={opts.description}
      data={data}
      params={params}
      options={{
        accounts: accounts.map((a) => ({ value: a.id, label: a.name })),
        expenseHeads,
        employees,
        investments,
      }}
      canCreate={can(user.permissions, info.module, kind === "BILL_ADJUSTMENT" ? "edit" : "create")}
      canVoid={can(user.permissions, info.module, "void")}
      today={todayIso()}
      withForm={opts.withForm}
      afterSave={opts.afterSave}
    />
  );
}
