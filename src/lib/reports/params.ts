// Report filters as they travel in the URL (and to the export route).
import { z } from "zod";
import { ISO_DATE_RE, isoToDate } from "@/lib/dates";
import { PARTY_KEYS } from "@/lib/masters";

const isoDate = z
  .string()
  .regex(ISO_DATE_RE)
  .refine((s) => {
    try {
      isoToDate(s);
      return true;
    } catch {
      return false;
    }
  })
  .optional()
  .catch(undefined);

const id = z
  .string()
  .max(40)
  .regex(/^[a-z0-9]+$/i)
  .optional()
  .catch(undefined);

const schema = z.object({
  from: isoDate,
  to: isoDate,
  asOf: isoDate,
  party: z.enum(PARTY_KEYS).catch("clients"),
  partyId: id,
  clientId: id,
  salesmanId: id,
  airlineId: id,
  vendorId: id,
  groupId: id,
  userId: id,
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  show: z.enum(["due", "advance", "all"]).catch("all"),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [20, 50, 100, 200].includes(n))
    .catch(50),
});

export type ReportParams = z.infer<typeof schema>;

export function parseReportParams(
  raw: Record<string, string | string[] | undefined>,
): ReportParams {
  const pick = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return schema.parse({
    from: pick("from"),
    to: pick("to"),
    asOf: pick("asOf"),
    party: pick("party"),
    partyId: pick("partyId"),
    clientId: pick("clientId"),
    salesmanId: pick("salesmanId"),
    airlineId: pick("airlineId"),
    vendorId: pick("vendorId"),
    groupId: pick("groupId"),
    userId: pick("userId"),
    year: pick("year"),
    show: pick("show"),
    page: pick("page") ?? 1,
    pageSize: pick("pageSize") ?? 50,
  });
}

/** Back to a query string (for export links). */
export function reportQuery(
  params: Partial<ReportParams>,
  extra: Record<string, string> = {},
): string {
  const q = new URLSearchParams(extra);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && k !== "page" && k !== "pageSize")
      q.set(k, String(v));
  }
  return q.toString();
}
