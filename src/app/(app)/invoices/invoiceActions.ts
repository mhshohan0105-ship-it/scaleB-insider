"use server";

// Server actions for every invoice type. Permission comes from the type's
// module (INVOICE_TYPE_INFO); the work is done by the type's service.
import { INVOICE_TYPE_INFO, INVOICE_TYPES, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import { ServiceError } from "@/server/services/errors";
import {
  createAirInvoice,
  postDraftAirInvoice,
  updateAirInvoice,
} from "@/server/services/invoices/airInvoiceService";
import { voidInvoice } from "@/server/services/invoices/invoiceCommon";
import {
  createItemInvoice,
  isItemInvoiceType,
  postDraftItemInvoice,
  updateItemInvoice,
} from "@/server/services/invoices/itemInvoiceService";
import {
  createReissueInvoice,
  postDraftReissueInvoice,
  reissuableTickets,
  updateReissueInvoice,
} from "@/server/services/invoices/reissueInvoiceService";
import {
  createVisaInvoice,
  postDraftVisaInvoice,
  setVisaStatus,
  updateVisaInvoice,
} from "@/server/services/invoices/visaInvoiceService";

function typeOf(type: string): InvoiceTypeKey {
  if (!(INVOICE_TYPES as readonly string[]).includes(type))
    throw new ServiceError("Unknown invoice type");
  return type as InvoiceTypeKey;
}

export async function createInvoiceAction(type: string, values: unknown) {
  return runAction(async () => {
    const t = typeOf(type);
    const ctx = await requirePermission(INVOICE_TYPE_INFO[t].module, "create");
    if (t === "AIR" || t === "NON_COMMISSION") return createAirInvoice(ctx, values, t);
    if (t === "VISA") return createVisaInvoice(ctx, values);
    if (t === "REISSUE") return createReissueInvoice(ctx, values);
    if (isItemInvoiceType(t)) return createItemInvoice(ctx, t, values);
    throw new ServiceError("This invoice type is not available yet");
  });
}

export async function updateInvoiceAction(type: string, id: string, values: unknown) {
  return runAction(async () => {
    const t = typeOf(type);
    const ctx = await requirePermission(INVOICE_TYPE_INFO[t].module, "edit");
    if (t === "AIR" || t === "NON_COMMISSION") await updateAirInvoice(ctx, id, values, t);
    else if (t === "VISA") await updateVisaInvoice(ctx, id, values);
    else if (t === "REISSUE") await updateReissueInvoice(ctx, id, values);
    else if (isItemInvoiceType(t)) await updateItemInvoice(ctx, t, id, values);
    else throw new ServiceError("This invoice type is not available yet");
    return { id };
  });
}

export async function postInvoiceAction(type: string, id: string) {
  return runAction(async () => {
    const t = typeOf(type);
    const ctx = await requirePermission(INVOICE_TYPE_INFO[t].module, "edit");
    if (t === "AIR" || t === "NON_COMMISSION") await postDraftAirInvoice(ctx, id, t);
    else if (t === "VISA") await postDraftVisaInvoice(ctx, id);
    else if (t === "REISSUE") await postDraftReissueInvoice(ctx, id);
    else if (isItemInvoiceType(t)) await postDraftItemInvoice(ctx, t, id);
    else throw new ServiceError("This invoice type is not available yet");
  });
}

export async function voidInvoiceAction(type: string, id: string, values: unknown) {
  return runAction(async () => {
    const t = typeOf(type);
    const ctx = await requirePermission(INVOICE_TYPE_INFO[t].module, "void");
    await voidInvoice(ctx, id, values, t);
  });
}

export async function setVisaStatusAction(lineId: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("invoice_visa", "edit");
    await setVisaStatus(ctx, lineId, values);
  });
}

/** A client's tickets that can be reissued (for the reissue form). */
export async function reissuableTicketsAction(clientId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("reissue", "create");
    return reissuableTickets(ctx, clientId);
  });
}
