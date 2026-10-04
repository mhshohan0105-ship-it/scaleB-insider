// Turns any invoice view (tickets, item lines, visa lines) into one printable
// shape so a single PDF layout serves every invoice type. Client prices only.
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import type { AirInvoiceView } from "@/server/services/invoices/airInvoiceService";
import type { ItemInvoiceView } from "@/server/services/invoices/itemInvoiceService";
import type { ReissueInvoiceView } from "@/server/services/invoices/reissueInvoiceService";
import type { VisaInvoiceView } from "@/server/services/invoices/visaInvoiceService";

export interface PdfCell {
  main: string;
  sub?: string | null;
}

export interface PdfColumn {
  label: string;
  flex: number;
  right?: boolean;
}

export interface PdfInvoice {
  number: string;
  status: string;
  typeLabel: string;
  date: string;
  dueDate: string | null;
  client: { name: string; code: string; phone: string | null; address: string | null };
  extraMeta: string[];
  columns: PdfColumn[];
  rows: { id: string; cells: PdfCell[] }[];
  linesLabel: string;
  subtotal: string;
  discount: string;
  serviceCharge: string;
  vat: string;
  netTotal: string;
  paidAmount: string;
  due: string;
  note: string | null;
}

type Common = Pick<
  PdfInvoice,
  | "number"
  | "status"
  | "date"
  | "dueDate"
  | "client"
  | "subtotal"
  | "discount"
  | "serviceCharge"
  | "vat"
  | "netTotal"
  | "paidAmount"
  | "due"
  | "note"
>;

function common(inv: Common): Common {
  return {
    number: inv.number,
    status: inv.status,
    date: inv.date,
    dueDate: inv.dueDate,
    client: inv.client,
    subtotal: inv.subtotal,
    discount: inv.discount,
    serviceCharge: inv.serviceCharge,
    vat: inv.vat,
    netTotal: inv.netTotal,
    paidAmount: inv.paidAmount,
    due: inv.due,
    note: inv.note,
  };
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
const amountCol: PdfColumn = { label: "Amount (BDT)", flex: 1.2, right: true };

export function ticketDocument(inv: AirInvoiceView): PdfInvoice {
  return {
    ...common(inv),
    typeLabel: INVOICE_TYPE_INFO[inv.type as InvoiceTypeKey].label,
    extraMeta: [],
    linesLabel: "Tickets",
    columns: [
      { label: "Passenger", flex: 2.2 },
      { label: "Ticket / PNR", flex: 1.6 },
      { label: "Flight", flex: 2 },
      { label: "Travel", flex: 1.4 },
      amountCol,
    ],
    rows: inv.tickets.map((t) => ({
      id: t.id,
      cells: [
        { main: t.passengerName, sub: join(t.passengerType, t.passportNo) },
        { main: t.ticketNo, sub: t.pnr ? `PNR ${t.pnr}` : null },
        { main: t.route, sub: join(t.airline, t.cabinClass) },
        {
          main: formatDate(t.journeyDate),
          sub: t.returnDate ? `Return ${formatDate(t.returnDate)}` : null,
        },
        { main: formatMoney(t.clientPrice) },
      ],
    })),
  };
}

export function itemDocument(inv: ItemInvoiceView): PdfInvoice {
  const qtyText = (q: string) => (Number.isInteger(Number(q)) ? String(Number(q)) : q);
  const extraMeta = [
    inv.tourGroup ? `Tour: ${inv.tourGroup.name}` : null,
    inv.group ? `Group: ${inv.group.name}` : null,
    inv.travelDate
      ? `Travel: ${formatDate(inv.travelDate)}${inv.returnDate ? ` to ${formatDate(inv.returnDate)}` : ""}`
      : null,
  ].filter((v): v is string => !!v);
  return {
    ...common(inv),
    typeLabel: INVOICE_TYPE_INFO[inv.type as InvoiceTypeKey].label,
    extraMeta,
    linesLabel: "Services",
    columns: [
      { label: "Description", flex: 3.4 },
      { label: "Date", flex: 1.2 },
      { label: "Qty", flex: 0.7, right: true },
      { label: "Rate", flex: 1.1, right: true },
      amountCol,
    ],
    // Cost-only lines (internal costs with no client price) are not printed.
    rows: inv.items
      .filter((it) => it.clientPrice !== "0.00")
      .map((it) => ({
        id: it.id,
        cells: [
          {
            main: it.passengerName ?? it.description ?? it.product ?? it.kind,
            sub: join(
              it.passengerName ? it.description : null,
              it.passportNo,
              it.product && it.product !== it.description ? it.product : null,
              it.roomType,
            ),
          },
          { main: it.serviceDate ? formatDate(it.serviceDate) : "" },
          { main: qtyText(it.qty) },
          { main: formatMoney(it.unitPrice) },
          { main: formatMoney(it.clientPrice) },
        ],
      })),
  };
}

export function visaDocument(inv: VisaInvoiceView): PdfInvoice {
  return {
    ...common(inv),
    typeLabel: "Visa",
    extraMeta: [],
    linesLabel: "Visas",
    columns: [
      { label: "Passenger", flex: 2.4 },
      { label: "Country", flex: 1.6 },
      { label: "Visa type", flex: 1.6 },
      amountCol,
    ],
    rows: inv.lines.map((l) => ({
      id: l.id,
      cells: [
        { main: l.passengerName, sub: l.passportNo },
        { main: l.country },
        { main: l.visaType ?? "" },
        { main: formatMoney(l.clientPrice) },
      ],
    })),
  };
}

export function reissueDocument(inv: ReissueInvoiceView): PdfInvoice {
  return {
    ...common(inv),
    typeLabel: "Reissue",
    extraMeta: [],
    linesLabel: "Reissues",
    columns: [
      { label: "Passenger", flex: 2 },
      { label: "Ticket", flex: 1.8 },
      { label: "New travel", flex: 1.4 },
      { label: "Penalty", flex: 1, right: true },
      { label: "Fare diff.", flex: 1, right: true },
      { label: "Service", flex: 1, right: true },
      amountCol,
    ],
    rows: inv.lines.map((l) => ({
      id: l.id,
      cells: [
        { main: l.passengerName, sub: join(l.airline, l.route) },
        {
          main: l.ticketNo ?? l.originalTicketNo,
          sub: l.ticketNo ? `was ${l.originalTicketNo}` : null,
        },
        {
          main: formatDate(l.journeyDate),
          sub: l.returnDate ? `Return ${formatDate(l.returnDate)}` : null,
        },
        { main: formatMoney(l.penalty) },
        { main: formatMoney(l.fareDifference) },
        { main: formatMoney(l.serviceCharge) },
        { main: formatMoney(l.clientPrice) },
      ],
    })),
  };
}
