// Full database backup: the dump restores into an empty database with every
// table identical (CHECKSUM TABLE), the file opens only with its key, and the
// nightly run writes to the server folder and records itself.
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newBackupKey, openBackup } from "@/server/backup/backupCrypto";
import { dumpDatabase, dumpStatements, sqlLiteral } from "@/server/backup/sqlDump";
import { prisma } from "@/server/db/prisma";
import { makeAgency } from "@/tests/integration/helpers";
import { backupOverview, runBackup } from "./platformBackup";

const RESTORE_DB = "scaleb_insider_restore_test";
let folder = "";

beforeAll(async () => {
  await makeAgency("bk"); // make sure there is data, including bcrypt hashes and JSON
  folder = await mkdtemp(path.join(tmpdir(), "scaleb-backup-"));
  process.env.BACKUP_DIR = folder;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${RESTORE_DB}\``);
  await rm(folder, { recursive: true, force: true });
  delete process.env.BACKUP_DIR;
});

describe("sqlLiteral", () => {
  it("escapes strings and formats values", () => {
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(true)).toBe("1");
    expect(sqlLiteral("it's a\\b\nc")).toBe("'it\\'s a\\\\b\\nc'");
    expect(sqlLiteral(new Date("2026-10-25T02:00:00.123Z"))).toBe("'2026-10-25 02:00:00.123'");
    expect(sqlLiteral(new Uint8Array([0, 255]))).toBe("X'00ff'");
    expect(sqlLiteral({ a: 1 })).toBe(`'{"a":1}'`);
  });
});

describe("full database backup", () => {
  it("restores into an empty database with identical tables", async () => {
    const dump = await dumpDatabase(prisma);
    expect(dump.tables).toBeGreaterThan(50);
    expect(dump.rows).toBeGreaterThan(0);

    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${RESTORE_DB}\``);
    await prisma.$executeRawUnsafe(
      `CREATE DATABASE \`${RESTORE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${RESTORE_DB}`;
    url.searchParams.set("connection_limit", "1"); // SET statements are per connection
    const target = new PrismaClient({ datasourceUrl: url.toString() });
    try {
      for (const stmt of dumpStatements(dump.sql.toString("utf8")))
        await target.$executeRawUnsafe(stmt);

      const tables = (
        await prisma.$queryRawUnsafe<Record<string, string>[]>(
          "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'",
        )
      ).map((r) => String(Object.values(r)[0]));
      for (const t of tables) {
        const [a] = await prisma.$queryRawUnsafe<{ Checksum: bigint | null }[]>(
          `CHECKSUM TABLE \`${t}\``,
        );
        const [b] = await target.$queryRawUnsafe<{ Checksum: bigint | null }[]>(
          `CHECKSUM TABLE \`${t}\``,
        );
        expect(String(b?.Checksum), t).toBe(String(a?.Checksum));
      }
    } finally {
      await target.$disconnect();
    }
  });

  it("writes an encrypted nightly copy and records the run", async () => {
    const run = await runBackup("scheduled", new Date("2026-10-24T20:00:00Z")); // 02:00 Dhaka
    expect(run.savedLocal).toBe(true);
    expect(run.fileName).toBe("scaleb-2026-10-25-0200-scheduled.sql.gz.enc");
    // Drive is not connected in tests, so the run is incomplete, not failed.
    expect(run.status).toBe("PARTIAL");
    expect(run.error).toContain("Google Drive is not connected");

    const files = await readdir(folder);
    expect(files).toContain(run.fileName);
    const sealed = await readFile(path.join(folder, run.fileName!));
    expect(sealed.includes(Buffer.from("CREATE TABLE"))).toBe(false); // not plain text

    const cfg = await prisma.backupConfig.findUniqueOrThrow({ where: { id: "default" } });
    const sql = openBackup(sealed, cfg.encryptionKey).toString("utf8");
    expect(sql).toMatch(/CREATE TABLE `agency`/i); // Windows MariaDB lower-cases names
    expect(() => openBackup(sealed, newBackupKey())).toThrow(/Wrong key/);
  });

  it("is only visible to platform administrators", async () => {
    const { owner, agency } = await makeAgency("bk2");
    await expect(
      backupOverview({ userId: owner.id, agencyId: agency.id, name: "x" }),
    ).rejects.toThrow(/Platform administrators/);
  });
});
