"use server";

import { runAction } from "@/server/actions/runAction";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { changeOwnPassword } from "@/server/services/users/userService";

/** Any signed in user may change their own password. */
export async function changePasswordAction(values: unknown) {
  return runAction(async () => {
    const ctx = await toServiceContext(await getUserContext());
    await changeOwnPassword(ctx, values);
  });
}
