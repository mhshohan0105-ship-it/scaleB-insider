"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { loginSchema } from "@/lib/schemas/auth";

export async function loginAction(input: unknown): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
    return {};
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "locked") {
      return { error: "Too many failed attempts. Please try again in 15 minutes." };
    }
    if (error instanceof CredentialsSignin) {
      return { error: "Incorrect agency code, username or password." };
    }
    if (error instanceof AuthError) {
      // Not a wrong password: something failed after the credentials were accepted.
      console.error("Sign-in failed:", error.type, error.cause ?? error.message);
      return { error: "Sign-in could not be completed. Please try again." };
    }
    throw error;
  }
}
