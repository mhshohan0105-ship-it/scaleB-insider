import { Prisma } from "@prisma/client";

/** An expected, user facing failure (validation, business rule, not found). */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(what = "Record") {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = "You do not have permission to do this") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
