// SMS helpers (PLAN.md Phase 12). Pure: phone numbers and message texts.

/**
 * Bangladesh mobile number in the international form gateways expect
 * ("8801XXXXXXXXX"), or null when it is not a mobile number.
 * Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX, with spaces or dashes.
 */
export function normalizeBdMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("880") ? digits.slice(2) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? `88${local}` : null;
}

/** GSM-7 messages longer than 160 characters (70 for Unicode) are sent in parts. */
export function smsParts(text: string): number {
  const unicode = /[^\x00-\x7F]/.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

export const SMS_EVENT_LABEL: Record<string, string> = {
  MANUAL: "Sent by hand",
  VISA_APPROVED: "Visa approved",
  VISA_DELIVERED: "Visa delivered",
  PASSPORT_EXPIRY: "Passport expiry reminder",
};

export function visaSms(
  status: "APPROVED" | "DELIVERED",
  v: { passengerName: string; country: string; agencyName: string },
): string {
  return status === "APPROVED"
    ? `Dear client, the ${v.country} visa for ${v.passengerName} has been approved. - ${v.agencyName}`
    : `Dear client, the ${v.country} visa for ${v.passengerName} is ready. Please collect it. - ${v.agencyName}`;
}

export function passportExpirySms(p: {
  name: string;
  passportNo: string;
  expiry: string;
  agencyName: string;
}): string {
  return `Dear ${p.name}, your passport ${p.passportNo} expires on ${p.expiry}. Renew it in time to travel. - ${p.agencyName}`;
}
