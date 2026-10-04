// Grants (or with --revoke, removes) platform admin rights for one user.
// Usage: npx tsx scripts/make-superadmin.ts <agencyCode> <username> [--revoke]
import { prisma } from "../src/server/db/prisma";

async function main() {
  const [code, username, flag] = process.argv.slice(2);
  if (!code || !username) {
    console.error("Usage: npx tsx scripts/make-superadmin.ts <agencyCode> <username> [--revoke]");
    process.exit(1);
  }
  const agency = await prisma.agency.findUnique({ where: { code: code.toLowerCase() } });
  if (!agency) throw new Error(`No agency with code "${code}"`);
  const user = await prisma.user.update({
    where: { agencyId_username: { agencyId: agency.id, username: username.toLowerCase() } },
    data: { isSuperAdmin: flag !== "--revoke" },
  });
  console.log(`${user.username}@${agency.code}: platform admin = ${user.isSuperAdmin}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
