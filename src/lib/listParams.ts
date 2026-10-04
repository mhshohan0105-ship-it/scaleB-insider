// Server side pagination/filter params carried in the URL (PLAN.md section 10).
import { z } from "zod";
import { ISO_DATE_RE, isoToDate } from "./dates";

export const PAGE_SIZES = [10, 20, 50, 100] as const;

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

const schema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
    .catch(20),
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["active", "inactive", "all"]).catch("active"),
  from: isoDate,
  to: isoDate,
});

export type ListParams = z.infer<typeof schema>;

type RawParams = Record<string, string | string[] | undefined>;

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseListParams(raw: RawParams): ListParams {
  return schema.parse({
    page: firstParam(raw.page) ?? 1,
    pageSize: firstParam(raw.pageSize) ?? 20,
    q: firstParam(raw.q) ?? "",
    status: firstParam(raw.status) ?? "active",
    from: firstParam(raw.from),
    to: firstParam(raw.to),
  });
}
