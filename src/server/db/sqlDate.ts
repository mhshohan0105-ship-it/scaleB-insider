import { Prisma } from "@prisma/client";

/**
 * A business date ("YYYY-MM-DD") as a SQL `date` literal for raw queries.
 * Passing a JS Date instead would arrive as a timestamp and be compared with
 * `date` columns in the database server's time zone, shifting days.
 */
export function sqlDate(iso: string): Prisma.Sql {
  return Prisma.sql`${iso}::date`;
}
