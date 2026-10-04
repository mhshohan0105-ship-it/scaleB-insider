// Credential verification. Runs before a tenant is known, so it uses the base
// Prisma client and scopes every query by the agency it resolves.
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import type { LoginInput } from "@/lib/schemas/auth";
import { LOCKOUT_WINDOW_MS, isLockedOut } from "./lockout";

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  agencyId: string;
  roleId: string;
}

export type LoginResult =
  { ok: true; user: AuthenticatedUser } | { ok: false; reason: "invalid" | "locked" };

interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

// Keeps response time similar whether or not the user exists.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 10);

export async function verifyLogin(input: LoginInput, meta: RequestMeta = {}): Promise<LoginResult> {
  const agency = await prisma.agency.findUnique({ where: { code: input.agencyCode } });
  const activeAgency = agency && agency.status !== "SUSPENDED" ? agency : null;

  if (activeAgency) {
    const recent = await prisma.loginHistory.findMany({
      where: {
        agencyId: activeAgency.id,
        username: input.username,
        at: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) },
      },
      orderBy: { at: "desc" },
      select: { success: true },
      take: 20,
    });
    if (isLockedOut(recent)) {
      await recordAttempt(activeAgency.id, null, input.username, false, meta);
      return { ok: false, reason: "locked" };
    }
  }

  const user = activeAgency
    ? await prisma.user.findUnique({
        where: { agencyId_username: { agencyId: activeAgency.id, username: input.username } },
      })
    : null;

  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!activeAgency || !user || !user.isActive || !passwordOk) {
    await recordAttempt(activeAgency?.id ?? null, user?.id ?? null, input.username, false, meta);
    return { ok: false, reason: "invalid" };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
    prisma.loginHistory.create({
      data: {
        agencyId: activeAgency.id,
        userId: user.id,
        username: input.username,
        success: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
        at: now,
      },
    }),
    prisma.auditLog.create({
      data: {
        agencyId: activeAgency.id,
        userId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      agencyId: user.agencyId,
      roleId: user.roleId,
    },
  };
}

async function recordAttempt(
  agencyId: string | null,
  userId: string | null,
  username: string,
  success: boolean,
  meta: RequestMeta,
) {
  await prisma.loginHistory.create({
    data: { agencyId, userId, username, success, ip: meta.ip, userAgent: meta.userAgent },
  });
}
