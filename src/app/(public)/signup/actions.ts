"use server";

// Public sign-up: no session yet. Limits and checks live in signupService.
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { runAction } from "@/server/actions/runAction";
import { requestSignupCode, signUp } from "@/server/services/signup/signupService";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || null;
}

export async function requestSignupCodeAction(values: unknown) {
  return runAction(async () => requestSignupCode(values, await clientIp()));
}

/** Creates the trial agency and signs its owner in. */
export async function signUpAction(values: unknown) {
  return runAction(async () => {
    const created = await signUp(values, await clientIp());
    const password = (values as { password?: unknown }).password;
    await signIn("credentials", {
      agencyCode: created.code,
      username: created.username,
      password: typeof password === "string" ? password : "",
      redirect: false,
    });
    return created;
  });
}
