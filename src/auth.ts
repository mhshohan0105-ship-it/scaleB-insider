import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { loginSchema } from "@/lib/schemas/auth";
import { verifyLogin } from "@/server/services/auth/login";
import { consumeImpersonation } from "@/server/services/admin/adminService";

class LockedOutError extends CredentialsSignin {
  code = "locked";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // Wrong passwords are expected (and recorded in LoginHistory); don't log them as errors.
    error(error) {
      if (error instanceof CredentialsSignin || error.name === "CredentialsSignin") return;
      console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: {
        agencyCode: { label: "Agency code" },
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const headers = request?.headers;
        const ip = headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const result = await verifyLogin(parsed.data, {
          ip,
          userAgent: headers?.get("user-agent") ?? null,
        });

        if (!result.ok) {
          if (result.reason === "locked") throw new LockedOutError();
          return null;
        }
        return result.user;
      },
    }),
    // Platform admin opening an agency as its owner, with a one-time token.
    Credentials({
      id: "impersonate",
      credentials: { token: { label: "Token" } },
      async authorize(raw) {
        const token = typeof raw?.token === "string" ? raw.token : "";
        if (!/^[a-f0-9]{64}$/.test(token)) return null;
        return consumeImpersonation(token);
      },
    }),
  ],
});
