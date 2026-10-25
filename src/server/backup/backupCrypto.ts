// Backup file format: gzip, then AES-256-GCM.
//   "SBK1" (4 bytes) | IV (12) | auth tag (16) | ciphertext
// The 32-byte key lives in BackupConfig and is downloaded once by the owner
// (Admin > Backups > Recovery key) so a backup can be opened without the server.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

const MAGIC = Buffer.from("SBK1");

export function newBackupKey(): string {
  return randomBytes(32).toString("base64");
}

function keyBytes(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64.trim(), "base64");
  if (key.length !== 32) throw new Error("The backup key must be 32 bytes (base64)");
  return key;
}

export function sealBackup(sql: Buffer, keyBase64: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(keyBase64), iv);
  const body = Buffer.concat([cipher.update(gzipSync(sql, { level: 9 })), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function openBackup(file: Buffer, keyBase64: string): Buffer {
  if (file.length < 32 || !file.subarray(0, 4).equals(MAGIC))
    throw new Error("Not a scaleB Insider backup file");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(keyBase64), file.subarray(4, 16));
  decipher.setAuthTag(file.subarray(16, 32));
  try {
    return gunzipSync(Buffer.concat([decipher.update(file.subarray(32)), decipher.final()]));
  } catch {
    throw new Error("Wrong key, or the backup file is damaged");
  }
}

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
