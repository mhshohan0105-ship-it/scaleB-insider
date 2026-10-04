// Roles and their permission maps (PLAN.md 2.5).
import { Prisma } from "@prisma/client";
import { parsePermissions, type PermissionMap } from "@/lib/permissions";
import { OWNER_ROLE_NAME, roleSchema } from "@/lib/schemas/roles";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError, isUniqueViolation } from "../errors";

export interface RoleRow {
  id: string;
  name: string;
  isSystem: boolean;
  locked: boolean;
  userCount: number;
  permissions: PermissionMap;
}

export async function listRoles(ctx: ServiceContext): Promise<RoleRow[]> {
  const roles = await tenantDb(ctx.agencyId).role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    isSystem: r.isSystem,
    locked: r.isSystem && r.name === OWNER_ROLE_NAME,
    userCount: r._count.users,
    permissions: parsePermissions(r.permissions),
  }));
}

function duplicateName(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ServiceError("A role with this name already exists", { name: "Name already in use" });
  }
  throw error;
}

export async function saveRole(
  ctx: ServiceContext,
  id: string | null,
  input: unknown,
): Promise<{ id: string }> {
  const data = roleSchema.parse(input);
  const permissions = data.permissions as Prisma.InputJsonValue;
  try {
    return await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      if (id) {
        const before = await tx.role.findFirst({ where: { id } });
        if (!before) throw new NotFoundError("Role");
        if (before.isSystem && before.name === OWNER_ROLE_NAME) {
          throw new ServiceError("The Owner role always has full access and cannot be changed");
        }
        // System roles keep their name; only permissions change.
        const name = before.isSystem ? before.name : data.name;
        const after = await tx.role.update({ where: { id }, data: { name, permissions } });
        await recordAudit(tx, ctx, {
          action: "UPDATE",
          entity: "Role",
          entityId: id,
          before,
          after,
        });
        return { id };
      }
      const created = await tx.role.create({
        data: { agencyId: ctx.agencyId, name: data.name, permissions, createdById: ctx.userId },
      });
      await recordAudit(tx, ctx, {
        action: "CREATE",
        entity: "Role",
        entityId: created.id,
        after: created,
      });
      return { id: created.id };
    });
  } catch (error) {
    duplicateName(error);
  }
}
