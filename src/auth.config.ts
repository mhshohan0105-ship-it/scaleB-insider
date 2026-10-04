// Edge safe Auth.js config shared by middleware and the full server config.
// No database or Node only imports here.
import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login"];

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
      if (isPublic) {
        if (auth?.user && request.nextUrl.pathname === "/login") {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id!;
        token.agencyId = user.agencyId;
        token.roleId = user.roleId;
        token.username = user.username;
        token.impersonatorId = user.impersonatorId ?? null;
        token.impersonatorName = user.impersonatorName ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.agencyId = token.agencyId;
      session.user.roleId = token.roleId;
      session.user.username = token.username;
      session.user.impersonatorName = token.impersonatorName ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
