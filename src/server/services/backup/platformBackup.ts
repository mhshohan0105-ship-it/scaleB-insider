// Full database backups (platform level, every agency at once): nightly at
// 02:00 Dhaka time from /api/cron/backup, or on demand from Admin > Backups.
// Each backup is an encrypted SQL dump saved in the server folder (outside
// public_html) and uploaded to the owner's Google Drive; old copies are pruned
// by the retention rule in src/lib/backup/retention.ts.
// Platform level work across agencies: uses the base client with explicit
// filters (documented exception to the tenant-scoped rule, like adminService).
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import {
  backupFileName,
  backupsToDelete,
  parseBackupName,
  type BackupFile,
  type BackupKind,
} from "@/lib/backup/retention";
import { todayIso } from "@/lib/dates";
import { APP_TIME_ZONE } from "@/lib/format";
import { newBackupKey, sealBackup, sha256 } from "@/server/backup/backupCrypto";
import * as drive from "@/server/backup/googleDrive";
import { dumpDatabase } from "@/server/backup/sqlDump";
import { prisma } from "@/server/db/prisma";
import { assertSuperAdmin, type AdminActor } from "../admin/adminService";
import { NotFoundError, ServiceError } from "../errors";
import { notify } from "../notifications/notificationService";

const CONFIG_ID = "default";
/** A run still marked RUNNING after this long is treated as dead. */
const STALE_MS = 30 * 60 * 1000;

export function backupDir(): string {
  return process.env.BACKUP_DIR || path.join(homedir(), "backups", "scaleb-insider");
}

function appUrl(): string {
  return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/admin/backups/google`;
}

async function config() {
  const found = await prisma.backupConfig.findUnique({ where: { id: CONFIG_ID } });
  if (found) return found;
  return prisma.backupConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, encryptionKey: newBackupKey() },
    update: {},
  });
}

async function audit(actor: AdminActor, action: string, after?: unknown) {
  await prisma.auditLog.create({
    data: {
      agencyId: actor.agencyId,
      userId: actor.userId,
      action,
      entity: "Backup",
      entityId: CONFIG_ID,
      after: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
    },
  });
}

const dhakaClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Tells every platform administrator (in their own agency) that a backup went wrong. */
async function alertAdmins(title: string, body: string) {
  const admins = await prisma.user.findMany({
    where: { isSuperAdmin: true, isActive: true },
    select: { agencyId: true },
    distinct: ["agencyId"],
  });
  for (const a of admins)
    await notify(a.agencyId, {
      module: "configuration",
      kind: "BACKUP_FAILED",
      title,
      body,
      link: "/admin/backups",
    });
}

async function pruneLocal(dir: string, today: string) {
  const files = (await readdir(dir))
    .map(parseBackupName)
    .filter((f): f is BackupFile => f !== null);
  for (const name of backupsToDelete(files, today)) await unlink(path.join(dir, name));
}

async function pushToDrive(
  cfg: Awaited<ReturnType<typeof config>>,
  name: string,
  data: Buffer,
  today: string,
) {
  const token = await drive.accessToken(
    { clientId: cfg.googleClientId!, clientSecret: cfg.googleClientSecret! },
    cfg.googleRefreshToken!,
  );
  const folderId = await drive.ensureFolder(token, cfg.driveFolderId);
  if (folderId !== cfg.driveFolderId)
    await prisma.backupConfig.update({ where: { id: CONFIG_ID }, data: { driveFolderId: folderId } });
  const fileId = await drive.uploadFile(token, folderId, name, data);

  const remote = await drive.listFiles(token, folderId);
  const parsed = remote
    .map((f) => ({ id: f.id, file: parseBackupName(f.name) }))
    .filter((f): f is { id: string; file: BackupFile } => f.file !== null);
  const drop = new Set(backupsToDelete(parsed.map((p) => p.file), today));
  for (const p of parsed) if (drop.has(p.file.name)) await drive.deleteFile(token, p.id);
  return fileId;
}

/**
 * Takes one full backup. Never throws for backup failures: the run row records
 * what happened and administrators are notified.
 */
export async function runBackup(kind: BackupKind, now = new Date()) {
  const running = await prisma.backupRun.findFirst({
    where: { status: "RUNNING", startedAt: { gt: new Date(now.getTime() - STALE_MS) } },
  });
  if (running) throw new ServiceError("A backup is already running. Try again in a few minutes.");

  const run = await prisma.backupRun.create({
    data: { kind: kind.toUpperCase(), status: "RUNNING", startedAt: now },
  });
  const today = todayIso(now);
  const name = backupFileName(today, dhakaClock.format(now), kind);
  const errors: string[] = [];
  let savedLocal = false;
  let driveFileId: string | null = null;

  try {
    const cfg = await config();
    const dump = await dumpDatabase(prisma, now);
    const sealed = sealBackup(dump.sql, cfg.encryptionKey);

    try {
      const dir = backupDir();
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), sealed, { mode: 0o600 });
      savedLocal = true;
      await pruneLocal(dir, today);
    } catch (e) {
      errors.push(`Server folder: ${(e as Error).message}`);
    }

    if (cfg.googleRefreshToken && cfg.googleClientId && cfg.googleClientSecret) {
      try {
        driveFileId = await pushToDrive(cfg, name, sealed, today);
      } catch (e) {
        errors.push(`Google Drive: ${(e as Error).message}`);
      }
    } else {
      errors.push("Google Drive is not connected");
    }

    const stored = savedLocal || driveFileId !== null;
    const status = !stored ? "FAILED" : errors.length ? "PARTIAL" : "OK";
    const done = await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status,
        fileName: name,
        sizeBytes: sealed.length,
        sha256: sha256(sealed),
        tables: dump.tables,
        rows: dump.rows,
        savedLocal,
        driveFileId,
        error: errors.length ? errors.join("\n") : null,
        finishedAt: new Date(),
      },
    });
    if (status !== "OK")
      await alertAdmins(
        status === "FAILED" ? "Database backup failed" : "Database backup incomplete",
        errors.join(" ").slice(0, 480),
      );
    return done;
  } catch (e) {
    const message = (e as Error).message;
    await alertAdmins("Database backup failed", message.slice(0, 480));
    return prisma.backupRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
  }
}

// ---- Admin > Backups -------------------------------------------------------

export async function backupOverview(actor: AdminActor) {
  await assertSuperAdmin(actor.userId);
  const cfg = await config();
  const runs = await prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 60 });
  let localFiles: { name: string; date: string; kind: BackupKind }[] = [];
  try {
    localFiles = (await readdir(backupDir()))
      .map(parseBackupName)
      .filter((f): f is BackupFile => f !== null)
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch {
    // folder not created yet
  }
  return {
    folder: backupDir(),
    redirectUri: googleRedirectUri(),
    drive: {
      hasClient: Boolean(cfg.googleClientId && cfg.googleClientSecret),
      clientId: cfg.googleClientId,
      connected: Boolean(cfg.googleRefreshToken),
      email: cfg.googleEmail,
    },
    runs: runs.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      fileName: r.fileName,
      sizeBytes: r.sizeBytes,
      tables: r.tables,
      rows: r.rows,
      savedLocal: r.savedLocal,
      onDrive: Boolean(r.driveFileId),
      error: r.error,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    localFiles,
  };
}

export type BackupOverview = Awaited<ReturnType<typeof backupOverview>>;

export async function backupNow(actor: AdminActor) {
  await assertSuperAdmin(actor.userId);
  const run = await runBackup("manual");
  await audit(actor, "BACKUP", { run: run.id, status: run.status, file: run.fileName });
  return { status: run.status, fileName: run.fileName, error: run.error };
}

const clientSchema = z.object({
  clientId: z.string().trim().min(10, "Paste the Client ID").max(300),
  clientSecret: z.string().trim().min(6, "Paste the Client secret").max(300),
});

/** Saves the Google OAuth client the owner created; a new client needs a new sign-in. */
export async function saveGoogleClient(actor: AdminActor, input: unknown) {
  await assertSuperAdmin(actor.userId);
  const v = clientSchema.parse(input);
  await config();
  await prisma.backupConfig.update({
    where: { id: CONFIG_ID },
    data: {
      googleClientId: v.clientId,
      googleClientSecret: v.clientSecret,
      googleRefreshToken: null,
      googleEmail: null,
    },
  });
  await audit(actor, "UPDATE", { googleClientId: v.clientId });
}

export async function googleConsentUrl(actor: AdminActor, state: string) {
  await assertSuperAdmin(actor.userId);
  const cfg = await config();
  if (!cfg.googleClientId || !cfg.googleClientSecret)
    throw new ServiceError("Save the Google Client ID and secret first");
  return drive.authUrl(
    {
      clientId: cfg.googleClientId,
      clientSecret: cfg.googleClientSecret,
      redirectUri: googleRedirectUri(),
    },
    state,
  );
}

export async function finishGoogleConnect(actor: AdminActor, code: string) {
  await assertSuperAdmin(actor.userId);
  const cfg = await config();
  if (!cfg.googleClientId || !cfg.googleClientSecret)
    throw new ServiceError("Save the Google Client ID and secret first");
  const { refreshToken, email } = await drive.finishAuth(
    {
      clientId: cfg.googleClientId,
      clientSecret: cfg.googleClientSecret,
      redirectUri: googleRedirectUri(),
    },
    code,
  );
  await prisma.backupConfig.update({
    where: { id: CONFIG_ID },
    data: { googleRefreshToken: refreshToken, googleEmail: email, driveFolderId: null },
  });
  await audit(actor, "UPDATE", { googleDrive: "connected", email });
}

export async function disconnectGoogle(actor: AdminActor) {
  await assertSuperAdmin(actor.userId);
  await config();
  await prisma.backupConfig.update({
    where: { id: CONFIG_ID },
    data: { googleRefreshToken: null, googleEmail: null },
  });
  await audit(actor, "UPDATE", { googleDrive: "disconnected" });
}

/** The key that opens every backup, for the owner to keep outside the server. */
export async function recoveryKey(actor: AdminActor) {
  await assertSuperAdmin(actor.userId);
  const cfg = await config();
  await audit(actor, "EXPORT", { recoveryKey: true });
  return cfg.encryptionKey;
}

/** One encrypted backup file from the server folder. */
export async function readBackupFile(actor: AdminActor, name: string) {
  await assertSuperAdmin(actor.userId);
  if (!parseBackupName(name)) throw new NotFoundError("Backup");
  try {
    const data = await readFile(path.join(backupDir(), name));
    await audit(actor, "EXPORT", { backupFile: name });
    return data;
  } catch {
    throw new NotFoundError("Backup");
  }
}
