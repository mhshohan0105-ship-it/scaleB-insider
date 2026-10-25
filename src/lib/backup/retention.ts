// Which full database backups to keep (pure, unit tested). The same rule runs
// on the server folder and on Google Drive:
//  - every backup from the last 30 days,
//  - the newest backup of each month for 12 months,
//  - the newest backup of each June (the Bangladesh fiscal year ends 30 June) forever,
//  - manual backups (taken before an update) for 90 days,
//  - and always the newest backup of all.

export type BackupKind = "scheduled" | "manual";

export interface BackupFile {
  name: string;
  /** Dhaka calendar date of the backup, YYYY-MM-DD. */
  date: string;
  kind: BackupKind;
}

const NAME = /^scaleb-(\d{4}-\d{2}-\d{2})-(\d{4})-(scheduled|manual)\.sql\.gz\.enc$/;

/** `scaleb-2026-10-25-0200-scheduled.sql.gz.enc` for a backup taken at 02:00 Dhaka time. */
export function backupFileName(dhakaDate: string, dhakaTime: string, kind: BackupKind): string {
  return `scaleb-${dhakaDate}-${dhakaTime.replace(":", "")}-${kind}.sql.gz.enc`;
}

export function parseBackupName(name: string): BackupFile | null {
  const m = NAME.exec(name);
  return m ? { name, date: m[1]!, kind: m[3] as BackupKind } : null;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function monthsBetween(from: string, to: string): number {
  const [fy = 0, fm = 0] = from.split("-").map(Number);
  const [ty = 0, tm = 0] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Names of the backups the rule no longer keeps. `today` is the Dhaka date. */
export function backupsToDelete(files: BackupFile[], today: string): string[] {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? 1 : -1)); // newest first
  if (!sorted[0]) return [];
  const keep = new Set<string>([sorted[0].name]);
  const newestOfMonth = new Map<string, string>();

  for (const f of sorted) {
    const age = daysBetween(f.date, today);
    if (f.kind === "manual") {
      if (age < 90) keep.add(f.name);
      continue;
    }
    if (age < 30) keep.add(f.name);
    const month = f.date.slice(0, 7);
    if (!newestOfMonth.has(month)) newestOfMonth.set(month, f.name);
  }
  for (const [month, name] of newestOfMonth) {
    const months = monthsBetween(`${month}-01`, today);
    if (months < 12 || month.endsWith("-06")) keep.add(name);
  }
  return sorted.filter((f) => !keep.has(f.name)).map((f) => f.name);
}
