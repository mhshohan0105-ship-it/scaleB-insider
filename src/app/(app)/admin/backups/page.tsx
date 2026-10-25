import { AccessDenied } from "@/components/ModulePlaceholder";
import { BackupsPage } from "@/components/platform/BackupsPage";
import { getUserContext } from "@/server/auth/session";
import { backupOverview } from "@/server/services/backup/platformBackup";

export default async function AdminBackupsRoute({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string; driveError?: string }>;
}) {
  const user = await getUserContext();
  if (!user.isSuperAdmin) return <AccessDenied />;
  const data = await backupOverview({
    userId: user.userId,
    agencyId: user.agencyId,
    name: user.name,
  });
  const sp = await searchParams;
  const driveMessage = sp.driveError
    ? { ok: false, text: `Google Drive was not connected: ${sp.driveError}` }
    : sp.drive === "connected"
      ? { ok: true, text: "Google Drive connected. The next backup goes there too." }
      : null;
  return <BackupsPage data={data} driveMessage={driveMessage} />;
}
