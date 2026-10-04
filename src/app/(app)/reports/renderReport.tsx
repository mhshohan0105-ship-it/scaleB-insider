import "server-only";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { Notice } from "@/components/Notice";
import { ReportFilters, type ReportFilterKind } from "@/components/reports/ReportFilters";
import { ReportShell } from "@/components/reports/ReportShell";
import { can } from "@/lib/permissions";
import { canRunReport } from "@/lib/reports/access";
import { REPORT_GROUPS, type DefaultPeriod } from "@/lib/reports/catalog";
import { firstParam } from "@/lib/listParams";
import { fiscalYear, monthStart, todayIso } from "@/lib/dates";
import { ReportPicker } from "@/components/reports/ReportPicker";
import { getAppConfig } from "@/server/services/settings/settingsService";
import { userOptions } from "@/server/services/users/userService";
import { parseReportParams, reportQuery, type ReportParams } from "@/lib/reports/params";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { REPORTS, isReportKey, type ReportKey } from "@/server/reports/registry";
import { ServiceError } from "@/server/services/errors";
import { masterOptions } from "@/server/services/masters/masterService";
import type { RawSearchParams } from "../loadEntityPage";

/**
 * Runs a report for a page: permission check, URL filters (with defaults),
 * lookups the filters need, and the ReportShell around the result.
 */
export async function renderReport(
  key: ReportKey,
  searchParams: Promise<RawSearchParams>,
  opts: {
    filters: ReportFilterKind[];
    defaults?: (p: ReportParams) => Partial<ReportParams>;
    description?: string;
    periodLabel?: string;
  },
) {
  const user = await getUserContext();
  if (!canRunReport(user.permissions, key)) return <AccessDenied />;
  const ctx = await toServiceContext(user);

  const raw = await searchParams;
  const parsed = parseReportParams(raw);
  const params = { ...parsed, ...(opts.defaults?.(parsed) ?? {}) };

  const [salesmen, airlines, groups, users] = await Promise.all([
    opts.filters.includes("salesman") ? masterOptions(ctx, "employees") : Promise.resolve([]),
    opts.filters.includes("airline") ? masterOptions(ctx, "airlines") : Promise.resolve([]),
    opts.filters.includes("group") ? masterOptions(ctx, "groups") : Promise.resolve([]),
    opts.filters.includes("user") ? userOptions(ctx) : Promise.resolve([]),
  ]);

  let report;
  try {
    report = await REPORTS[key](ctx, params);
  } catch (e) {
    if (e instanceof ServiceError) return <Notice type="warning" message={e.message} />;
    throw e;
  }

  return (
    <ReportShell
      report={report}
      exportKey={key}
      exportQuery={reportQuery(params)}
      canExport={can(user.permissions, "reports", "export")}
      description={opts.description}
      filters={
        <ReportFilters
          params={params}
          show={opts.filters}
          salesmen={salesmen}
          airlines={airlines}
          groups={groups}
          users={users}
          periodLabel={opts.periodLabel}
        />
      }
    />
  );
}

/**
 * A report page with several reports (PLAN.md section 7): a picker, then the
 * chosen report with its filters and default period.
 */
export async function renderReportGroup(groupKey: string, searchParams: Promise<RawSearchParams>) {
  const group = REPORT_GROUPS.find((g) => g.key === groupKey);
  if (!group) return <AccessDenied />;
  const user = await getUserContext();
  const reports = group.reports.filter((r) => canRunReport(user.permissions, r.key));
  if (!reports.length) return <AccessDenied />;
  const raw = await searchParams;
  const wanted = firstParam(raw.report);
  const info = reports.find((r) => r.key === wanted) ?? reports[0]!;
  if (!isReportKey(info.key)) return <Notice type="warning" message="Unknown report" />;
  const fyStart = (await getAppConfig(await toServiceContext(user))).fiscalYearStart;
  return (
    <>
      <ReportPicker title={group.title} active={info.key} reports={reports} />
      {await renderReport(info.key, Promise.resolve(raw), {
        filters: info.filters,
        description: info.description,
        periodLabel: info.periodLabel,
        defaults: (p) => defaultPeriod(p, info.period ?? "none", fyStart),
      })}
    </>
  );
}

function defaultPeriod(
  p: ReportParams,
  period: DefaultPeriod,
  fyStart: number,
): Partial<ReportParams> {
  if (p.from || p.to || period === "none") return {};
  const today = todayIso();
  if (period === "month") return { from: monthStart(today), to: today };
  return { from: fiscalYear(today, fyStart).from, to: today };
}
