// Creates an agency with its owner from the command line (first install, or
// when no platform admin exists yet).
// Usage: npx tsx scripts/create-agency.ts <code> "<Agency name>" <ownerUsername> "<Owner name>"
// The owner password comes from OWNER_PASSWORD, or is asked for (not shown on
// screen, typed twice) when that variable is not set.
import { stdin, stdout } from "node:process";
import { prisma } from "../src/server/db/prisma";
import { provisionAgency, provisionSchema } from "../src/server/services/agency/provisionAgency";

/** Reads a line from the terminal without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY)
      return reject(new Error("No terminal to ask for the password; set OWNER_PASSWORD"));
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          return reject(new Error("Cancelled"));
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [code, name, username, ownerName] = process.argv.slice(2);
  if (!code || !name || !username || !ownerName) {
    console.error(
      'Usage: npx tsx scripts/create-agency.ts <code> "<Agency name>" <ownerUsername> "<Owner name>"',
    );
    process.exit(1);
  }
  let password = process.env.OWNER_PASSWORD;
  if (!password) {
    password = await askHidden(`Password for ${username} (at least 8 characters): `);
    const again = await askHidden("Type it again: ");
    if (password !== again)
      throw new Error("The two passwords are different. Nothing was created.");
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
