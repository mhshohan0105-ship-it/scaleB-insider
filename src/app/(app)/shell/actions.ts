"use server";

// Header actions: global search and the notification bell. Any signed-in user;
// search results are limited to what the user may view.
import { runAction } from "@/server/actions/runAction";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { markRead, myNotifications } from "@/server/services/notifications/notificationService";
import { globalSearch } from "@/server/services/search/globalSearch";

export async function globalSearchAction(q: string) {
  return runAction(async () => {
    const user = await getUserContext();
    return globalSearch(
      await toServiceContext(user),
      user.permissions,
      String(q ?? "").slice(0, 80),
    );
  });
}

export async function notificationsAction() {
  return runAction(async () => myNotifications(await toServiceContext(await getUserContext())));
}

export async function markReadAction(id?: string) {
  return runAction(async () => markRead(await toServiceContext(await getUserContext()), id));
}
