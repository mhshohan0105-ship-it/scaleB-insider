import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { exportTenantData } from "@/server/services/backup/backupService";

export async function GET() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "export")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const data = await exportTenantData(await toServiceContext(user));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="scaleb-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
