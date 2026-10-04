import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext } from "@/server/auth/session";
import { BackupCard } from "./BackupCard";

export default async function BackupPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  return <BackupCard canExport={can(user.permissions, "configuration", "export")} />;
}
