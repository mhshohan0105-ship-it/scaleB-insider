import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/actionResult";
import { ServiceError, isUniqueViolation } from "@/server/services/errors";

/** Turns a ZodError into { "field.path": "first message" }. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Runs a server action body and maps expected failures to an ActionResult.
 * Next.js redirects/notFound are re-thrown untouched.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: zodFieldErrors(error),
      };
    }
    if (error instanceof ServiceError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (isUniqueViolation(error)) {
      return { ok: false, error: "A record with the same value already exists." };
    }
    console.error(error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
