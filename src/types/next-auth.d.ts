import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    agencyId: string;
    roleId: string;
    username: string;
    /** Set when a platform admin opened this agency as its owner. */
    impersonatorId?: string | null;
    impersonatorName?: string | null;
  }

  interface Session {
    user: {
      id: string;
      agencyId: string;
      roleId: string;
      username: string;
      impersonatorName?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    agencyId: string;
    roleId: string;
    username: string;
    impersonatorId?: string | null;
    impersonatorName?: string | null;
  }
}
