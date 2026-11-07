// Quick client creation: from the "+ Add new client" entry of a client picker
// (its own transaction), or together with an invoice (the invoice's
// transaction, so a failed invoice leaves no half-made client behind).
import type { z } from "zod";
import { PARTIES } from "@/lib/parties";
import { newClientSchema } from "@/lib/schemas/invoices";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { ServiceError } from "../errors";
import { formatNumber, nextSequence } from "../numbering/sequence";

/** 8801711000000 / +8801711000000 / 01711000000 -> 01711000000 */
export function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^88(?=01)/, "");
}

function samePhone(db: TenantDb | TenantTx, phone: string) {
  return db.client.findFirst({
    where: { phone: { in: [phone, `88${phone}`, `+88${phone}`] } },
    select: { id: true, name: true, code: true },
  });
}

export async function createClientInTx(
  tx: TenantTx,
  ctx: ServiceContext,
  input: z.output<typeof newClientSchema>,
): Promise<string> {
  const phone = normalisePhone(input.phone);
  const same = await samePhone(tx, phone);
  if (same)
    throw new ServiceError(`${same.name} (${same.code}) already has this mobile number`, {
      "newClient.phone": `Already used by ${same.name} (${same.code})`,
    });
  const n = await nextSequence(tx, ctx.agencyId, "PARTY_CLIENTS");
  const client = await tx.client.create({
    data: {
      agencyId: ctx.agencyId,
      code: formatNumber(PARTIES.clients.codePrefix!, n),
      type: input.type,
      name: input.name,
      phone,
      email: input.email ?? null,
      address: input.address ?? null,
      createdById: ctx.userId,
    },
  });
  await recordAudit(tx, ctx, {
    action: "CREATE",
    entity: "Client",
    entityId: client.id,
    after: client,
  });
  return client.id;
}

/** "+ Add new client" from a client picker. */
export async function quickCreateClient(ctx: ServiceContext, input: unknown) {
  const data = newClientSchema.parse(input);
  const id = await tenantDb(ctx.agencyId).$transaction((tx) => createClientInTx(tx, ctx, data));
  return { id };
}

/** The client who already has this mobile number, as a picker option. */
export async function findClientByPhone(ctx: ServiceContext, phone: string) {
  const digits = normalisePhone(phone);
  if (!/^01\d{9}$/.test(digits)) return null;
  const same = await samePhone(tenantDb(ctx.agencyId), digits);
  return same ? { value: same.id, label: `${same.name} (${same.code})` } : null;
}

/** What the invoice form shows next to the chosen client. */
export async function clientSnapshot(ctx: ServiceContext, clientId: string) {
  const db = tenantDb(ctx.agencyId);
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { balance: true },
  });
  if (!client) return null;
  const dueInvoices = await db.invoice.count({
    where: { clientId, status: { in: ["POSTED", "PARTIAL"] } },
  });
  return { balance: client.balance.toFixed(2), dueInvoices };
}
