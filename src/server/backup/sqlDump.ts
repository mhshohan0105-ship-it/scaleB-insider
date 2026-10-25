// Full logical dump of the database as SQL (tables in their exact names, then
// their rows), importable with phpMyAdmin or `mariadb db < file.sql`.
// Written in JS because the shared host has no shell for mysqldump. Platform
// level: reads every table of every agency through the base client
// (documented exception to the tenant-scoped rule).
import { Prisma, type PrismaClient } from "@prisma/client";

const BATCH = 500;

/** One SQL literal for a value as Prisma returns it from a raw query. */
export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`Cannot dump the number ${v}`);
    return String(v);
  }
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Prisma.Decimal) return v.toString();
  if (v instanceof Date) return `'${v.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (v instanceof Uint8Array) return v.length ? `X'${Buffer.from(v).toString("hex")}'` : "''";
  if (typeof v === "string") return quote(v);
  return quote(JSON.stringify(v));
}

function quote(s: string): string {
  return `'${s.replace(/[\0\n\r\x1a'\\]/g, (c) => {
    switch (c) {
      case "\0":
        return "\\0";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\x1a":
        return "\\Z";
      case "'":
        return "\\'";
      default:
        return "\\\\";
    }
  })}'`;
}

const ident = (name: string) => `\`${name.replace(/`/g, "``")}\``;

export interface DumpResult {
  sql: Buffer;
  tables: number;
  rows: number;
}

export async function dumpDatabase(db: PrismaClient, now = new Date()): Promise<DumpResult> {
  const parts: string[] = [
    `-- scaleB Insider full database backup, ${now.toISOString()}\n`,
    "SET NAMES utf8mb4;\n",
    "SET time_zone = '+00:00';\n",
    "SET FOREIGN_KEY_CHECKS = 0;\n",
    "SET UNIQUE_CHECKS = 0;\n",
    "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n",
  ];
  const tableRows = await db.$queryRawUnsafe<Record<string, string>[]>(
    "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'",
  );
  const tables = tableRows.map((r) => String(Object.values(r)[0])).sort();
  let rowCount = 0;

  for (const table of tables) {
    const [create] = await db.$queryRawUnsafe<Record<string, string>[]>(
      `SHOW CREATE TABLE ${ident(table)}`,
    );
    const ddl = create?.["Create Table"];
    if (!ddl) throw new Error(`No definition for table ${table}`);
    parts.push(`DROP TABLE IF EXISTS ${ident(table)};\n`, `${ddl};\n`);

    const keyCols = await db.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
      `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`,
      table,
    );
    const order = keyCols.length
      ? ` ORDER BY ${keyCols.map((k) => ident(k.COLUMN_NAME)).join(", ")}`
      : "";

    for (let offset = 0; ; offset += BATCH) {
      const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM ${ident(table)}${order} LIMIT ${BATCH} OFFSET ${offset}`,
      );
      if (!rows[0]) break;
      const cols = Object.keys(rows[0]).map(ident).join(", ");
      const values = rows.map((r) => `(${Object.values(r).map(sqlLiteral).join(", ")})`);
      parts.push(`INSERT INTO ${ident(table)} (${cols}) VALUES\n${values.join(",\n")};\n`);
      rowCount += rows.length;
      if (rows.length < BATCH) break;
    }
    parts.push("\n");
  }
  parts.push("SET FOREIGN_KEY_CHECKS = 1;\nSET UNIQUE_CHECKS = 1;\n");
  return { sql: Buffer.from(parts.join(""), "utf8"), tables: tables.length, rows: rowCount };
}

/**
 * Splits a dump made by dumpDatabase into statements. Values never contain a
 * raw newline (they are escaped), so every statement ends with ";\n".
 */
export function dumpStatements(sql: string): string[] {
  return sql
    .split(/;\n/)
    .map((s) =>
      s
        .split("\n")
        .filter((l) => !l.startsWith("-- "))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}
