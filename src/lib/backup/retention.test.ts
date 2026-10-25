import { describe, expect, it } from "vitest";
import { backupFileName, backupsToDelete, parseBackupName, type BackupFile } from "./retention";

function daily(from: string, days: number): BackupFile[] {
  const out: BackupFile[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push({ name: backupFileName(date, "02:00", "scheduled"), date, kind: "scheduled" });
  }
  return out;
}

describe("backup file names", () => {
  it("round-trips", () => {
    const name = backupFileName("2026-10-25", "02:00", "scheduled");
    expect(name).toBe("scaleb-2026-10-25-0200-scheduled.sql.gz.enc");
    expect(parseBackupName(name)).toEqual({ name, date: "2026-10-25", kind: "scheduled" });
  });

  it("ignores other files", () => {
    expect(parseBackupName("notes.txt")).toBeNull();
    expect(parseBackupName("scaleb-2026-10-25-0200-scheduled.sql")).toBeNull();
  });
});

describe("backupsToDelete", () => {
  it("keeps everything from the last 30 days", () => {
    const files = daily("2026-09-26", 30); // 26 Sep .. 25 Oct
    expect(backupsToDelete(files, "2026-10-25")).toEqual([]);
  });

  it("keeps only the newest backup of older months, for 12 months", () => {
    const files = daily("2025-08-01", 451); // Aug 2025 .. 25 Oct 2026
    const deleted = new Set(backupsToDelete(files, "2026-10-25"));
    const kept = files.filter((f) => !deleted.has(f.name)).map((f) => f.date);

    // last 30 days
    expect(kept.filter((d) => d >= "2026-09-26")).toHaveLength(30);
    // month ends Nov 2025 .. Aug 2026 (and Sep 2026 is inside the 30 days)
    for (const d of ["2025-11-30", "2026-01-31", "2026-02-28", "2026-08-31"])
      expect(kept).toContain(d);
    expect(kept).not.toContain("2026-01-15");
    // Oct 2025 is 12 months back: gone; Aug-Oct 2025 likewise
    expect(kept).not.toContain("2025-10-31");
    expect(kept).not.toContain("2025-08-31");
  });

  it("keeps the newest June backup of every year forever", () => {
    const files = [
      ...daily("2023-06-25", 10), // 25 Jun .. 4 Jul 2023
      ...daily("2026-10-20", 6),
    ];
    const deleted = new Set(backupsToDelete(files, "2026-10-25"));
    expect(deleted.has("scaleb-2023-06-30-0200-scheduled.sql.gz.enc")).toBe(false);
    expect(deleted.has("scaleb-2023-06-29-0200-scheduled.sql.gz.enc")).toBe(true);
    expect(deleted.has("scaleb-2023-07-04-0200-scheduled.sql.gz.enc")).toBe(true);
  });

  it("keeps manual backups for 90 days", () => {
    const manual = (date: string): BackupFile => ({
      name: backupFileName(date, "15:30", "manual"),
      date,
      kind: "manual",
    });
    const files = [...daily("2026-10-24", 2), manual("2026-08-01"), manual("2026-07-01")];
    expect(backupsToDelete(files, "2026-10-25")).toEqual([
      "scaleb-2026-07-01-1530-manual.sql.gz.enc",
    ]);
  });

  it("never deletes the newest backup", () => {
    const files = daily("2024-01-10", 1);
    expect(backupsToDelete(files, "2026-10-25")).toEqual([]);
  });
});
