import "server-only";
// Page renderers shared by every invoice type (list / new / view / edit).
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { Notice } from "@/components/Notice";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { ItemInvoiceForm, type ItemFormType } from "@/components/invoices/ItemInvoiceForm";
import { ItemInvoiceView } from "@/components/invoices/ItemInvoiceView";
import { ReissueInvoiceForm } from "@/components/invoices/ReissueInvoiceForm";
import { ReissueInvoiceView } from "@/components/invoices/ReissueInvoiceView";
import { VisaInvoiceForm } from "@/components/invoices/VisaInvoiceForm";
import { VisaInvoiceView } from "@/components/invoices/VisaInvoiceView";
import { todayIso } from "@/lib/dates";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import type { ServiceContext } from "@/server/services/context";
import { getAirInvoice, toFormValues } from "@/server/services/invoices/airInvoiceService";
import { listInvoices } from "@/server/services/invoices/invoiceCommon";
import {
  getItemInvoice,
  itemFormValues,
  tourItineraryOptions,
} from "@/server/services/invoices/itemInvoiceService";
import {
  getReissueInvoice,
  reissueFormValues,
} from "@/server/services/invoices/reissueInvoiceService";
import { getVisaInvoice, visaFormValues } from "@/server/services/invoices/visaInvoiceService";
import { invoiceRefunds } from "@/server/services/refund/postRefund";
import { pilgrimOptions } from "@/server/services/hajj/pilgrimService";
import { masterOptions } from "@/server/services/masters/masterService";
import type { RawSearchParams } from "../loadEntityPage";
import { AirInvoiceForm } from "./airticket/AirInvoiceForm";
import { AirInvoiceView } from "./airticket/[id]/AirInvoiceView";
import { airInvoiceFormOptions } from "./airticket/formOptions";

type Action = "view" | "create" | "edit";

async function access(type: InvoiceTypeKey, action: Action) {
  const user = await getUserContext();
  const moduleKey = INVOICE_TYPE_INFO[type].module;
  return {
    user,
    allowed: can(user.permissions, moduleKey, action),
    canEdit: can(user.permissions, moduleKey, "edit"),
    canVoid: can(user.permissions, moduleKey, "void"),
    canReceive: can(user.permissions, "money_receipt", "create"),
    canRefund: can(user.permissions, "refund", "create"),
    ctx: await toServiceContext(user),
  };
}

export async function renderInvoiceList(
  type: InvoiceTypeKey,
  searchParams: Promise<RawSearchParams>,
) {
  const a = await access(type, "view");
  if (!a.allowed) return <AccessDenied />;
  const raw = await searchParams;
  const params = parseListParams(raw);
  const status = firstParam(raw.invoiceStatus);
  const data = await listInvoices(a.ctx, type, { ...params, status });
  const info = INVOICE_TYPE_INFO[type];
  return (
    <InvoiceList
      title={`${info.label} Invoices`}
      basePath={info.path}
      data={data}
      params={params}
      status={status}
      canCreate={can(a.user.permissions, info.module, "create")}
    />
  );
}

async function itemOptions(ctx: ServiceContext, type: ItemFormType, pilgrimIds: string[] = []) {
  const hajj = type === "HAJJ_PRE_REG" || type === "HAJJ";
  const [employees, products, groups, roomTypes, tourGroups, itinerary, pilgrims] =
    await Promise.all([
      masterOptions(ctx, "employees"),
      masterOptions(ctx, "products"),
      masterOptions(ctx, "groups"),
      masterOptions(ctx, "roomtypes"),
      masterOptions(ctx, "tourgroups"),
      type === "TOUR" ? tourItineraryOptions(ctx) : Promise.resolve([]),
      // Active pilgrims, plus any already on the invoice being edited.
      hajj ? pilgrimOptions(ctx, { ids: pilgrimIds }) : Promise.resolve([]),
    ]);
  return { employees, products, groups, roomTypes, tourGroups, itinerary, pilgrims };
}

async function visaOptions(ctx: ServiceContext) {
  const [employees, visaTypes, countries] = await Promise.all([
    masterOptions(ctx, "employees"),
    masterOptions(ctx, "visatypes"),
    masterOptions(ctx, "countries"),
  ]);
  return { employees, visaTypes, countries };
}

export async function renderNewInvoice(type: InvoiceTypeKey) {
  const a = await access(type, "create");
  if (!a.allowed) return <AccessDenied />;
  const today = todayIso();
  const kind = INVOICE_TYPE_INFO[type].lines;
  if (type === "AIR" || type === "NON_COMMISSION") {
    return (
      <AirInvoiceForm
        type={type}
        mode="create"
        today={today}
        {...await airInvoiceFormOptions(a.ctx)}
      />
    );
  }
  if (kind === "visa")
    return <VisaInvoiceForm mode="create" today={today} {...await visaOptions(a.ctx)} />;
  if (kind === "reissue")
    return (
      <ReissueInvoiceForm
        mode="create"
        today={today}
        employees={await masterOptions(a.ctx, "employees")}
      />
    );
  const itemType = type as ItemFormType;
  return (
    <ItemInvoiceForm
      type={itemType}
      mode="create"
      today={today}
      options={await itemOptions(a.ctx, itemType)}
    />
  );
}

export async function renderInvoiceView(type: InvoiceTypeKey, id: string) {
  const a = await access(type, "view");
  if (!a.allowed) return <AccessDenied />;
  const flags = {
    canEdit: a.canEdit,
    canVoid: a.canVoid,
    canReceive: a.canReceive,
    canRefund: a.canRefund,
  };
  const refunds = await invoiceRefunds(a.ctx, id);
  if (type === "AIR" || type === "NON_COMMISSION") {
    const invoice = await getAirInvoice(a.ctx, id, type);
    if (!invoice) notFound();
    return <AirInvoiceView invoice={{ ...invoice, refunds }} {...flags} />;
  }
  if (type === "VISA") {
    const invoice = await getVisaInvoice(a.ctx, id);
    if (!invoice) notFound();
    return <VisaInvoiceView invoice={{ ...invoice, refunds }} {...flags} />;
  }
  if (type === "REISSUE") {
    const invoice = await getReissueInvoice(a.ctx, id);
    if (!invoice) notFound();
    return <ReissueInvoiceView invoice={{ ...invoice, refunds }} {...flags} />;
  }
  const invoice = await getItemInvoice(a.ctx, type, id);
  if (!invoice) notFound();
  return <ItemInvoiceView invoice={{ ...invoice, refunds }} {...flags} />;
}

function locked(number: string, status: string) {
  return (
    <Notice
      type="warning"
      message={`Invoice ${number} is ${status.toLowerCase()} and cannot be edited.`}
    />
  );
}

export async function renderEditInvoice(type: InvoiceTypeKey, id: string) {
  const a = await access(type, "edit");
  if (!a.allowed) return <AccessDenied />;
  const today = todayIso();
  const frozen = (s: string) => s === "VOID" || s === "REFUNDED";

  if (type === "AIR" || type === "NON_COMMISSION") {
    const inv = await getAirInvoice(a.ctx, id, type);
    if (!inv) notFound();
    if (frozen(inv.status)) return locked(inv.number, inv.status);
    return (
      <AirInvoiceForm
        type={type}
        mode="edit"
        invoiceId={inv.id}
        invoiceNumber={inv.number}
        isDraft={inv.status === "DRAFT"}
        initial={toFormValues(inv)}
        today={today}
        {...await airInvoiceFormOptions(a.ctx)}
      />
    );
  }
  if (type === "REISSUE") {
    const inv = await getReissueInvoice(a.ctx, id);
    if (!inv) notFound();
    if (frozen(inv.status)) return locked(inv.number, inv.status);
    return (
      <ReissueInvoiceForm
        mode="edit"
        invoiceId={inv.id}
        invoiceNumber={inv.number}
        isDraft={inv.status === "DRAFT"}
        initial={reissueFormValues(inv)}
        today={today}
        employees={await masterOptions(a.ctx, "employees")}
      />
    );
  }
  if (type === "VISA") {
    const inv = await getVisaInvoice(a.ctx, id);
    if (!inv) notFound();
    if (frozen(inv.status)) return locked(inv.number, inv.status);
    const values = visaFormValues(inv);
    return (
      <VisaInvoiceForm
        mode="edit"
        invoiceId={inv.id}
        invoiceNumber={inv.number}
        isDraft={inv.status === "DRAFT"}
        initial={{
          ...values,
          lines: values.lines.map((l, i) => ({ ...l, status: inv.lines[i]!.status })),
        }}
        today={today}
        {...await visaOptions(a.ctx)}
      />
    );
  }
  const inv = await getItemInvoice(a.ctx, type, id);
  if (!inv) notFound();
  if (frozen(inv.status)) return locked(inv.number, inv.status);
  const itemType = type as ItemFormType;
  return (
    <ItemInvoiceForm
      type={itemType}
      mode="edit"
      invoiceId={inv.id}
      invoiceNumber={inv.number}
      isDraft={inv.status === "DRAFT"}
      initial={itemFormValues(inv)}
      today={today}
      options={await itemOptions(
        a.ctx,
        itemType,
        inv.items.map((i) => i.pilgrimId).filter((x): x is string => !!x),
      )}
    />
  );
}
