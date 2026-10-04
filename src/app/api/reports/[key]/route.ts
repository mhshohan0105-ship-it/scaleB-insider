// Report export: /api/reports/<key>?format=pdf|xlsx&<filters>
import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { can } from "@/lib/permissions";
import { canRunReport } from "@/lib/reports/access";
import { parseReportParams } from "@/lib/reports/params";
import { recordAudit } from "@/server/audit/audit";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { tenantDb } from "@/server/db/tenant";
import { reportToExcel } from "@/server/reports/export/excel";
import { ReportPdf } from "@/server/reports/export/ReportPdf";
import { REPORTS, isReportKey } from "@/server/reports/registry";
import { ServiceError } from "@/server/services/errors";
import { getProfile } from "@/server/services/settings/settingsService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isReportKey(key)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";

  const user = await getUserContext();
  if (
    !canRunReport(user.permissions, key) ||
    (format === "xlsx" && !can(user.permissions, "reports", "export"))
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const ctx = await toServiceContext(user);
  const p = parseReportParams(Object.fromEntries(req.nextUrl.searchParams));

  let report;
  try {
    report = await REPORTS[key](ctx, p, true);
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const agency = await getProfile(ctx);
  await tenantDb(ctx.agencyId).$transaction((tx) =>
    recordAudit(tx, ctx, {
      action: "EXPORT",
      entity: "Report",
      entityId: key,
      after: { format, params: p },
    }),
  );

  const stem = `${report.title.replace(/[^\w-]+/g, "-").replace(/-+/g, "-")}`.slice(0, 60);
  if (format === "xlsx") {
    const buf = await reportToExcel(report, agency.name);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${stem}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const pdf = await renderToBuffer(createElement(ReportPdf, { report, agency }) as never);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${stem}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
