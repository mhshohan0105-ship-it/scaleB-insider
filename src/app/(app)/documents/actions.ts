"use server";

// Server actions for passports (module "passport") and quotations (module "quotation").
import { todayIso } from "@/lib/dates";
import { INVOICE_TYPE_INFO } from "@/lib/invoiceTypes";
import { can } from "@/lib/permissions";
import { ForbiddenError } from "@/server/services/errors";
import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import {
  changePassportStatus,
  savePassport,
  setPassportActive,
} from "@/server/services/passports/passportService";
import {
  convertQuotation,
  quotationInvoiceType,
  saveQuotation,
  setQuotationStatus,
} from "@/server/services/quotations/quotationService";

export async function savePassportAction(id: string | null, values: unknown) {
  return runAction(async () =>
    savePassport(await requirePermission("passport", id ? "edit" : "create"), id, values),
  );
}

export async function changePassportStatusAction(id: string, values: unknown) {
  return runAction(async () =>
    changePassportStatus(await requirePermission("passport", "edit"), id, values),
  );
}

export async function setPassportActiveAction(id: string, active: boolean) {
  return runAction(async () =>
    setPassportActive(await requirePermission("passport", "edit"), id, active),
  );
}

export async function saveQuotationAction(id: string | null, values: unknown) {
  return runAction(async () =>
    saveQuotation(await requirePermission("quotation", id ? "edit" : "create"), id, values),
  );
}

export async function setQuotationStatusAction(id: string, values: unknown) {
  return runAction(async () =>
    setQuotationStatus(await requirePermission("quotation", "edit"), id, values),
  );
}

export async function convertQuotationAction(id: string) {
  return runAction(async () => {
    const ctx = await requirePermission("quotation", "edit");
    // Converting creates an invoice: the user must be allowed to create that type.
    const type = await quotationInvoiceType(ctx, id);
    if (type && !can(ctx.user.permissions, INVOICE_TYPE_INFO[type].module, "create"))
      throw new ForbiddenError(`You cannot create ${INVOICE_TYPE_INFO[type].label} invoices`);
    return convertQuotation(ctx, id, todayIso());
  });
}
