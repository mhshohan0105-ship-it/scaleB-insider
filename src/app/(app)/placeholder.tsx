import "server-only";
import { AccessDenied, ModulePlaceholder } from "@/components/ModulePlaceholder";
import { entryPhase, findNavEntry } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { getUserContext } from "@/server/auth/session";

/**
 * Renders the "coming in Phase N" placeholder for a sidebar path that is not
 * built yet, or null when the path is not a sidebar entry.
 */
export async function renderPlaceholder(path: string) {
  const entry = findNavEntry(path);
  if (!entry) return null;
  const ctx = await getUserContext();
  if (!can(ctx.permissions, entry.module.module, "view")) return <AccessDenied />;
  return (
    <ModulePlaceholder
      moduleLabel={entry.module.label}
      pageLabel={entry.leaf.label}
      phase={entryPhase(entry)}
    />
  );
}
