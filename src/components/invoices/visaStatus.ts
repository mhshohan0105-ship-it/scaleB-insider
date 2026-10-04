export const VISA_STATUS_ORDER = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "DELIVERED",
] as const;

export const VISA_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DELIVERED: "Delivered",
};

export const VISA_STATUS_COLOR: Record<string, string> = {
  PENDING: "default",
  SUBMITTED: "processing",
  APPROVED: "success",
  REJECTED: "error",
  DELIVERED: "green",
};

/** Sensible next steps from a status (the board shows these as buttons). */
export const VISA_NEXT: Record<string, string[]> = {
  PENDING: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: ["DELIVERED"],
  REJECTED: ["SUBMITTED"],
  DELIVERED: [],
};
