// Base (unscoped) Prisma client. Only pre-tenant code such as login and the
// tenant extension itself may use this directly; services use the tenant
// scoped client (src/server/db/tenant.ts).
import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "./connectionUrl";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Postings serialise on the agency's voucher counter (gap-free numbering),
    // so a transaction may wait behind others when several people post at once.
    // Prisma's defaults (2s to start, 5s to finish) are too tight for that.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
