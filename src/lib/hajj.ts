// Hajj pilgrim rules (PLAN.md 6.17). Pure, shared by the pages and services.
//
//   PRE_REGISTERED ──register──> REGISTERED
//   TRANSFERRED_IN (arrives from another agency, registered or not)
//   any active ──transfer out──> TRANSFERRED_OUT
//   not yet registered ──cancel pre registration──> CANCELLED
//   registered ──cancel registration──> CANCELLED
//
// "Active" pilgrims are ours and still going; moallem and group transfers
// apply only to them.

export const PILGRIM_STATUSES = [
  "PRE_REGISTERED",
  "REGISTERED",
  "TRANSFERRED_IN",
  "TRANSFERRED_OUT",
  "CANCELLED",
] as const;
export type PilgrimStatusKey = (typeof PILGRIM_STATUSES)[number];

export const PILGRIM_STATUS_LABEL: Record<PilgrimStatusKey, string> = {
  PRE_REGISTERED: "Pre registered",
  REGISTERED: "Registered",
  TRANSFERRED_IN: "Transferred in",
  TRANSFERRED_OUT: "Transferred out",
  CANCELLED: "Cancelled",
};

export const PILGRIM_STATUS_COLOR: Record<PilgrimStatusKey, string> = {
  PRE_REGISTERED: "blue",
  REGISTERED: "green",
  TRANSFERRED_IN: "cyan",
  TRANSFERRED_OUT: "default",
  CANCELLED: "red",
};

export const ACTIVE_STATUSES: readonly PilgrimStatusKey[] = [
  "PRE_REGISTERED",
  "REGISTERED",
  "TRANSFERRED_IN",
];

export type PilgrimAction =
  "REGISTER" | "CANCEL_PRE_REG" | "CANCEL_REG" | "MOALLEM" | "GROUP" | "OUT";

export interface PilgrimState {
  status: string;
  regNo?: string | null;
}

export function isActive(p: PilgrimState): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(p.status);
}

/** Registered here, or arrived by transfer already registered. */
export function isRegistered(p: PilgrimState): boolean {
  return p.status === "REGISTERED" || (p.status === "TRANSFERRED_IN" && !!p.regNo);
}

/** Why the action is not allowed for this pilgrim, or null when it is. */
export function pilgrimActionError(action: PilgrimAction, p: PilgrimState): string | null {
  if (!isActive(p)) {
    return p.status === "CANCELLED"
      ? "This pilgrim is cancelled"
      : "This pilgrim has been transferred out";
  }
  switch (action) {
    case "REGISTER":
    case "CANCEL_PRE_REG":
      return isRegistered(p) ? "This pilgrim is already registered" : null;
    case "CANCEL_REG":
      return isRegistered(p) ? null : "This pilgrim is not registered yet";
    default:
      return null;
  }
}

export const TRANSFER_TYPE_LABEL: Record<string, string> = {
  MOALLEM: "Moallem transfer",
  GROUP: "Group transfer",
  IN: "Transfer in",
  OUT: "Transfer out",
};

export const PILGRIM_EVENT_LABEL: Record<string, string> = {
  CREATED: "Added",
  UPDATED: "Details changed",
  REGISTERED: "Registered",
  MOALLEM_TRANSFER: "Moallem changed",
  GROUP_TRANSFER: "Group changed",
  TRANSFER_IN: "Transferred in",
  TRANSFER_OUT: "Transferred out",
  CANCELLED_PRE_REG: "Pre registration cancelled",
  CANCELLED_REG: "Registration cancelled",
  TRANSFER_VOIDED: "Transfer voided",
};
