// Download of the backup recovery key (platform administrators only).
import { NextResponse } from "next/server";
import { getUserContext } from "@/server/auth/session";
import { recoveryKey } from "@/server/services/backup/platformBackup";

export async function GET() {
  const user = await getUserContext();
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const key = await recoveryKey({ userId: user.userId, agencyId: user.agencyId, name: user.name });
  const text = [
    "scaleB Insider backup recovery key",
    "",
    key,
    "",
    "Every backup file (*.sql.gz.enc) is encrypted with this key. Keep this file",
    "somewhere safe outside the server (password manager, USB drive). Without it",
    "the backups on Google Drive cannot be opened.",
    "",
    "To open a backup:",
    "  npx tsx scripts/open-backup.ts <backup file> <this key file>",
    "This writes the .sql file, which can be imported with phpMyAdmin.",
    "",
  ].join("\n");
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scaleb-backup-recovery-key.txt"',
      "Cache-Control": "no-store",
    },
  });
}
