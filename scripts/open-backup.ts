// Decrypts a scaleB Insider backup into a plain .sql file (for phpMyAdmin import
// or `mariadb DBNAME < file.sql`).
// Usage: npx tsx scripts/open-backup.ts <backup.sql.gz.enc> <recovery-key.txt | base64 key>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { openBackup } from "../src/server/backup/backupCrypto";

const [file, keyArg] = process.argv.slice(2);
if (!file || !keyArg) {
  console.error("Usage: npx tsx scripts/open-backup.ts <backup.sql.gz.enc> <recovery-key.txt | key>");
  process.exit(1);
}
const keyText = existsSync(keyArg) ? readFileSync(keyArg, "utf8") : keyArg;
const key = keyText.split(/\s+/).find((w) => /^[A-Za-z0-9+/]{43}=$/.test(w));
if (!key) {
  console.error("No backup key found (44 characters of base64).");
  process.exit(1);
}
const out = file.replace(/\.gz\.enc$/, "");
writeFileSync(out, openBackup(readFileSync(file), key));
console.log(`Wrote ${out}`);
