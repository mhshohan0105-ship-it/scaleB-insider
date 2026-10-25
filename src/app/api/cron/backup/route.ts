// Nightly full database backup (02:00 Dhaka time): encrypted SQL dump saved in
// the server folder and uploaded to Google Drive, old copies pruned.
// Call with: Authorization: Bearer <CRON_SECRET>.
import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorised } from "@/server/cron/auth";
import { runBackup } from "@/server/services/backup/platformBackup";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const run = await runBackup("scheduled");
    return NextResponse.json(
      { status: run.status, file: run.fileName, error: run.error },
      { status: run.status === "FAILED" ? 500 : 200 },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
