// Users of an agency (Configuration > Users) and the signed in user's password.
import bcrypt from "bcryptjs";
import {
  changePasswordSchema,
  resetPasswordSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/lib/schemas/users";
import type { ListParams } from "@/lib/listParams";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError, isUniqueViolation } from "../errors";

const BCRYPT_ROUNDS = 10;

export interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  roleId: string;
  roleName: string;
  employeeId: string | null;
  employeeName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

const safeSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  roleId: true,
  employeeId: true,
  isActive: true,
  lastLoginAt: true,
} as const;

export async function listUsers(
  ctx: ServiceContext,
  params: ListParams,
): Promise<{ rows: UserRow[]; total: number }> {
  const db = tenantDb(ctx.agencyId);
  const where: Record<string, unknown> = {};
  if (params.status !== "all") where.isActive = params.status === "active";
  if (params.q) {
    where.OR = ["name", "username", "email", "phone"].map((f) => ({
      [f]: { contains: params.q, mode: "insensitive" },
    }));
  }
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        ...safeSelect,
        role: { select: { name: true } },
        employee: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.user.count({ where }),
  ]);
  return {
    total,
    rows: rows.map(({ role, employee, lastLoginAt, ...u }) => ({
      ...u,
      roleName: role.name,
      employeeName: employee?.name ?? null,
      lastLoginAt: lastLoginAt?.toISOString() ?? null,
    })),
  };
}

async function assertRoleAndEmployee(tx: TenantTx, roleId: string, employeeId: string | null) {
  const role = await tx.role.findFirst({ where: { id: roleId }, select: { id: true } });
  if (!role) throw new ServiceError("Role not found", { roleId: "Choose a valid role" });
  if (employeeId) {
    const emp = await tx.employee.findFirst({ where: { id: employeeId }, select: { id: true } });
    if (!emp)
      throw new ServiceError("Employee not found", { employeeId: "Choose a valid employee" });
  }
}

function usernameTaken(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ServiceError("That username is already in use", {
      username: "Username already in use",
    });
  }
  throw error;
}

export async function createUser(ctx: ServiceContext, input: unknown): Promise<{ id: string }> {
  const data = userCreateSchema.parse(input);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  try {
    return await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      await assertRoleAndEmployee(tx, data.roleId, data.employeeId);
      const user = await tx.user.create({
        data: {
          agencyId: ctx.agencyId,
          name: data.name,
          username: data.username,
          email: data.email,
          phone: data.phone,
          roleId: data.roleId,
          employeeId: data.employeeId,
          passwordHash,
          createdById: ctx.userId,
        },
        select: safeSelect,
      });
      await recordAudit(tx, ctx, {
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        after: user,
      });
      return { id: user.id };
    });
  } catch (error) {
    usernameTaken(error);
  }
}

export async function updateUser(ctx: ServiceContext, id: string, input: unknown): Promise<void> {
  const data = userUpdateSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.user.findFirst({ where: { id }, select: safeSelect });
    if (!before) throw new NotFoundError("User");
    if (id === ctx.userId && data.roleId !== before.roleId) {
      throw new ServiceError("You cannot change your own role", {
        roleId: "You cannot change your own role",
      });
    }
    await assertRoleAndEmployee(tx, data.roleId, data.employeeId);
    const after = await tx.user.update({ where: { id }, data, select: safeSelect });
    await recordAudit(tx, ctx, { action: "UPDATE", entity: "User", entityId: id, before, after });
  });
}

export async function setUserActive(
  ctx: ServiceContext,
  id: string,
  active: boolean,
): Promise<void> {
  if (id === ctx.userId && !active)
    throw new ServiceError("You cannot deactivate your own account");
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.user.findFirst({ where: { id }, select: safeSelect });
    if (!before) throw new NotFoundError("User");
    if (before.isActive === active) return;
    const after = await tx.user.update({
      where: { id },
      data: { isActive: active },
      select: safeSelect,
    });
    await recordAudit(tx, ctx, {
      action: active ? "ACTIVATE" : "DEACTIVATE",
      entity: "User",
      entityId: id,
      before,
      after,
    });
  });
}

/** Admin sets a new password for another user. */
export async function resetUserPassword(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { password } = resetPasswordSchema.parse(input);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundError("User");
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await recordAudit(tx, ctx, { action: "PASSWORD_RESET", entity: "User", entityId: id });
  });
}

/** The signed in user changes their own password. */
export async function changeOwnPassword(ctx: ServiceContext, input: unknown): Promise<void> {
  if (!ctx.userId) throw new ServiceError("Not signed in");
  const data = changePasswordSchema.parse(input);
  const db = tenantDb(ctx.agencyId);
  const user = await db.user.findFirst({ where: { id: ctx.userId } });
  if (!user) throw new NotFoundError("User");
  if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
    throw new ServiceError("Current password is incorrect", {
      currentPassword: "Current password is incorrect",
    });
  }
  const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await recordAudit(tx, ctx, { action: "PASSWORD_CHANGE", entity: "User", entityId: user.id });
  });
}

export async function userFormOptions(ctx: ServiceContext) {
  const db = tenantDb(ctx.agencyId);
  const [roles, employees] = await Promise.all([
    db.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    roles: roles.map((r) => ({ value: r.id, label: r.name })),
    employees: employees.map((e) => ({ value: e.id, label: e.name })),
  };
}

/** Users as pick list options (report filters). */
export async function userOptions(
  ctx: ServiceContext,
): Promise<{ value: string; label: string }[]> {
  const rows = await tenantDb(ctx.agencyId).user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, username: true },
  });
  return rows.map((u) => ({ value: u.id, label: `${u.name} (${u.username})` }));
}
