// Creates an agency with its owner from the command line (first install, or
// when no platform admin exists yet).
// Usage: npx tsx scripts/create-agency.ts <code> "<Agency name>" <ownerUsername> "<Owner name>"
// The owner password is read from the OWNER_PASSWORD environment variable.
import { prisma } from "../src/server/db/prisma";
import { provisionAgency, provisionSchema } from "../src/server/services/agency/provisionAgency";

async function main() {
  const [code, name, username, ownerName] = process.argv.slice(2);
  const password = process.env.OWNER_PASSWORD;
  if (!code || !name || !username || !ownerName || !password) {
    console.error(
      'Usage: OWNER_PASSWORD=... npx tsx scripts/create-agency.ts <code> "<Agency name>" <ownerUsername> "<Owner name>"',
    );
    process.exit(1);
  }
  const input = provisionSchema.parse({
    code,
    name,
    owner: { name: ownerName, username, password },
  });
  const { agency } = await provisionAgency(input);
  console.log(`Created agency ${agency.code} (${agency.name}); owner: ${input.owner.username}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
