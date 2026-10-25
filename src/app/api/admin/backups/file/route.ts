// Download of one encrypted backup from the server folder (platform administrators only).
import { NextResponse, type NextRequest } from "next/server";
import { getUserContext } from "@/server/auth/session";
import { readBackupFile } from "@/server/services/backup/platformBackup";

export async function GET(req: NextRequest) {
  const user = await getUserContext();
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const name = req.nextUrl.searchParams.get("name") ?? "";
  try {
    const data = await readBackupFile(
      { userId: user.userId, agencyId: user.agencyId, name: user.name },
      name,
    );
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }
}
