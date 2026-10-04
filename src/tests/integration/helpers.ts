import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db/prisma";
import { provisionAgency } from "@/server/services/agency/provisionAgency";
import type { ServiceContext } from "@/server/services/context";

export const TEST_PASSWORD = "Testpass123";

/** Provisions a fresh agency with a unique code and returns contexts for its users. */
export async function makeAgency(label: string) {
  const code = `${label}-${randomUUID().slice(0, 8)}`;
  const { agency, owner, roleIds } = await provisionAgency({
    code,
    name: `${label} Travels`,
    owner: { name: `${label} Owner`, username: "owner", password: TEST_PASSWORD },
  });
  const viewer = await prisma.user.create({
    data: {
      agencyId: agency.id,
      name: `${label} Viewer`,
      username: "viewer",
      passwordHash: owner.passwordHash,
      roleId: roleIds.Viewer!,
    },
  });
  const ctx: ServiceContext = { agencyId: agency.id, userId: owner.id };
  return { agency, owner, viewer, roleIds, ctx };
}
