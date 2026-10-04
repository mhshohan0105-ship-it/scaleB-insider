import "server-only";
// Page renderers for Quotations (module "quotation").
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import {
  QuotationDetail,
  QuotationForm,
  QuotationListPage,
} from "@/components/quotations/QuotationPages";
import { todayIso } from "@/lib/dates";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { masterOptions } from "@/server/services/masters/masterService";
import {
  getQuotation,
  listQuotations,
  quotationFormValues,
} from "@/server/services/quotations/quotationService";
import { getAppConfig } from "@/server/services/settings/settingsService";
import type { RawSearchParams } from "../loadEntityPage";

async function access(action: "view" | "create" | "edit") {
  const user = await getUserContext();
  return {
    user,
    allowed: can(user.permissions, "quotation", action),
    ctx: await toServiceContext(user),
  };
}

export async function renderQuotationList(searchParams: Promise<RawSearchParams>) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const raw = await searchParams;
  const params = parseListParams(raw);
  const status = firstParam(raw.quoteStatus) || undefined;
  const data = await listQuotations(a.ctx, { ...params, quoteStatus: status }, todayIso());
  return (
    <QuotationListPage
      data={data}
      params={params}
      status={status}
      canCreate={can(a.user.permissions, "quotation", "create")}
    />
  );
}

export async function renderQuotationForm(id: string | null) {
  const a = await access(id ? "edit" : "create");
  if (!a.allowed) return <AccessDenied />;
  const [products, config, q] = await Promise.all([
    masterOptions(a.ctx, "products"),
    getAppConfig(a.ctx),
    id ? getQuotation(a.ctx, id, todayIso()) : Promise.resolve(null),
  ]);
  if (id && !q) notFound();
  return (
    <QuotationForm
      quotationId={q?.id}
      number={q?.number}
      initial={q ? quotationFormValues(q) : undefined}
      products={products}
      today={todayIso()}
      defaultTerms={config.invoiceTerms}
    />
  );
}

export async function renderQuotation(id: string) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const q = await getQuotation(a.ctx, id, todayIso());
  if (!q) notFound();
  const canEdit = can(a.user.permissions, "quotation", "edit");
  const invoiceModule = INVOICE_TYPE_INFO[q.invoiceType as InvoiceTypeKey].module;
  return (
    <QuotationDetail
      q={q}
      canEdit={canEdit}
      canConvert={canEdit && can(a.user.permissions, invoiceModule, "create")}
    />
  );
}
