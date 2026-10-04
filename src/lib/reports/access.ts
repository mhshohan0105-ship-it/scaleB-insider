// Who may run a report: Reports view, plus any extra permission the report
// needs (sensitive ones such as the audit trail).
import { can, type PermissionMap } from "@/lib/permissions";
import { REPORT_INFO } from "./catalog";

export function canRunReport(permissions: PermissionMap, key: string): boolean {
  if (!can(permissions, "reports", "view")) return false;
  const req = REPORT_INFO[key]?.requires;
  return !req || can(permissions, req.module, req.action);
}
