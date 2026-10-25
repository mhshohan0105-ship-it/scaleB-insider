/* eslint-disable jsx-a11y/alt-text -- react-pdf <Image> is not an HTML img and takes no alt */
// Printable invoice for every invoice type (PLAN.md 6.1), in the approved
// layout: logo and agency details with a verification QR, bill-to and invoice
// details, passengers and passports, billing lines, totals with amount in
// words, a PAID / PARTIAL / DUE stamp, signatures and footer. Client prices
// only, never cost or profit. What prints is set in Agency Profile.
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import type { AgencyProfile, PdfOptions } from "@/server/services/settings/settingsService";
import type { PdfInvoice } from "./invoiceDocument";
import { BRAND, MUTED } from "./layout";

export interface PdfImage {
  data: Buffer;
  format: "png" | "jpg";
}

export interface InvoiceBranding {
  logo: PdfImage | null;
  seal: PdfImage | null;
  /** QR code PNG for the verification link (null when switched off). */
  qr: Buffer | null;
  options: PdfOptions;
}

const INK = "#18211f";
const LINE = "#e3e9e7";

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 54, paddingHorizontal: 36, fontSize: 9, fontFamily: "Helvetica", color: INK },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 170, maxHeight: 60, objectFit: "contain" },
  agencyName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: BRAND },
  agencyRight: { alignItems: "flex-end", maxWidth: 260 },
  small: { fontSize: 8.5, color: MUTED, lineHeight: 1.45 },
  qrBox: { alignItems: "center", marginLeft: 12 },
  qr: { width: 62, height: 62 },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 14 },
  titleRule: { flexGrow: 1, height: 1.5, backgroundColor: BRAND },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BRAND, letterSpacing: 3, marginHorizontal: 12 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  label: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.8, marginBottom: 3 },
  billName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2.5 },
  metaKey: { color: MUTED, width: 70, textAlign: "right", marginRight: 10 },
  metaVal: { minWidth: 90, textAlign: "right" },
  section: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: BRAND, letterSpacing: 0.8, marginTop: 6, marginBottom: 5 },
  th: { flexDirection: "row", backgroundColor: BRAND },
  thCell: { padding: 5, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: LINE },
  td: { padding: 5 },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  below: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  words: { flexGrow: 1, flexBasis: 0, paddingRight: 20 },
  totals: { width: 220, borderWidth: 0.5, borderColor: LINE, borderRadius: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4.5, paddingHorizontal: 9, borderBottomWidth: 0.5, borderColor: LINE },
  totalStrong: { backgroundColor: "#f3f6f5" },
  stamp: { position: "absolute", top: 430, left: 205, borderWidth: 2.5, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 18, fontSize: 30, fontFamily: "Helvetica-Bold", letterSpacing: 5, transform: "rotate(-16deg)", opacity: 0.42 },
  signRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 34 },
  sign: { width: 160, alignItems: "center" },
  signLine: { width: "100%", borderTopWidth: 0.7, borderColor: INK, marginTop: 3, paddingTop: 3, textAlign: "center", fontSize: 8.5 },
  seal: { maxWidth: 110, maxHeight: 44, objectFit: "contain" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderColor: LINE, paddingTop: 5 },
});

const STAMPS: Record<string, { text: string; color: string } | undefined> = {
  PAID: { text: "PAID", color: "#067647" },
  PARTIAL: { text: "PARTIAL", color: "#b54708" },
  POSTED: { text: "DUE", color: "#b42318" },
  VOID: { text: "VOID", color: "#4a5a56" },
  DRAFT: { text: "DRAFT", color: "#4a5a56" },
  REFUNDED: { text: "REFUNDED", color: "#4a5a56" },
};

function Total({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={[s.totalRow, strong ? s.totalStrong : {}]}>
      <Text style={[strong ? s.bold : {}, color ? { color } : {}]}>{label}</Text>
      <Text style={[strong ? s.bold : {}, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

export function InvoicePdf({
  invoice,
  agency,
  branding,
  terms,
  footer,
}: {
  invoice: PdfInvoice;
  agency: AgencyProfile;
  branding: InvoiceBranding;
  terms: string | null;
  footer: string | null;
}) {
  const { options } = branding;
  const stampStatus =
    invoice.status === "POSTED" && invoice.due === "0.00" ? "PAID" : invoice.status;
  const stamp =
    invoice.status === "VOID" || invoice.status === "DRAFT" || options.showStamp
      ? STAMPS[stampStatus]
      : undefined;
  const cols = invoice.columns;
  const contact = [agency.phone, agency.email].filter(Boolean).join("  ·  ");
  const web = [agency.website, agency.facebook].filter(Boolean).join("  ·  ");
  const ids = [
    agency.tradeLicense && `Trade licence ${agency.tradeLicense}`,
    agency.iataNo && `IATA ${agency.iataNo}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document title={`Invoice ${invoice.number}`} author={agency.name}>
      <Page size="A4" style={s.page}>
        {stamp && (
          <Text style={[s.stamp, { color: stamp.color, borderColor: stamp.color }]} fixed>
            {stamp.text}
          </Text>
        )}

        <View style={s.head}>
          <View style={{ maxWidth: 220 }}>
            {branding.logo ? (
              <Image style={s.logo} src={branding.logo} />
            ) : (
              <Text style={s.agencyName}>{agency.name}</Text>
            )}
            {ids ? <Text style={[s.small, { marginTop: 6 }]}>{ids}</Text> : null}
          </View>
          <View style={{ flexDirection: "row" }}>
            <View style={s.agencyRight}>
              {branding.logo && <Text style={[s.agencyName, { fontSize: 12.5 }]}>{agency.name}</Text>}
              {agency.address && <Text style={[s.small, { textAlign: "right" }]}>{agency.address}</Text>}
              {contact ? <Text style={s.small}>{contact}</Text> : null}
              {web ? <Text style={s.small}>{web}</Text> : null}
            </View>
            {branding.qr && (
              <View style={s.qrBox}>
                <Image style={s.qr} src={{ data: branding.qr, format: "png" }} />
                <Text style={[s.small, { fontSize: 6.5 }]}>Scan to verify</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.titleRow}>
          <View style={s.titleRule} />
          <Text style={s.title}>INVOICE</Text>
          <View style={s.titleRule} />
        </View>

        <View style={s.parties}>
          <View style={{ maxWidth: 270 }}>
            <Text style={s.label}>BILL TO</Text>
            <Text style={s.billName}>
              {invoice.client.name}
              <Text style={[s.small, { fontSize: 9 }]}>  ({invoice.client.code})</Text>
            </Text>
            {invoice.client.phone && <Text>Mobile {invoice.client.phone}</Text>}
            {invoice.client.address && <Text style={s.small}>{invoice.client.address}</Text>}
            {invoice.extraMeta.map((m) => (
              <Text key={m} style={s.small}>
                {m}
              </Text>
            ))}
          </View>
          <View>
            <View style={s.metaRow}>
              <Text style={s.metaKey}>Invoice no</Text>
              <Text style={[s.metaVal, s.bold]}>{invoice.number}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaKey}>Type</Text>
              <Text style={s.metaVal}>{invoice.typeLabel}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaKey}>Invoice date</Text>
              <Text style={s.metaVal}>{formatDate(invoice.date)}</Text>
            </View>
            {invoice.dueDate && (
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Due date</Text>
                <Text style={s.metaVal}>{formatDate(invoice.dueDate)}</Text>
              </View>
            )}
            {invoice.soldBy && (
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Sold by</Text>
                <Text style={s.metaVal}>{invoice.soldBy}</Text>
              </View>
            )}
          </View>
        </View>

        {options.showPassports && invoice.passengers.length > 0 && (
          <View>
            <Text style={s.section}>PASSENGERS &amp; PASSPORTS</Text>
            <View style={s.th}>
              <Text style={[s.thCell, { flex: 0.4 }]}>#</Text>
              <Text style={[s.thCell, { flex: 1.6 }]}>Passport</Text>
              <Text style={[s.thCell, { flex: 3 }]}>Name</Text>
              <Text style={[s.thCell, { flex: 1.2 }]}>Type</Text>
            </View>
            {invoice.passengers.map((p, i) => (
              <View key={`${p.name}${p.passport ?? ""}`} style={s.tr} wrap={false}>
                <Text style={[s.td, { flex: 0.4 }]}>{i + 1}</Text>
                <Text style={[s.td, { flex: 1.6 }]}>{p.passport ?? ""}</Text>
                <Text style={[s.td, { flex: 3 }]}>{p.name}</Text>
                <Text style={[s.td, { flex: 1.2 }]}>{p.type ?? ""}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[s.section, { marginTop: 12 }]}>BILLING</Text>
        <View style={s.th}>
          {cols.map((c) => (
            <Text key={c.label} style={[s.thCell, { flex: c.flex }, c.right ? s.right : {}]}>
              {c.label}
            </Text>
          ))}
        </View>
        {invoice.rows.map((row) => (
          <View key={row.id} style={s.tr} wrap={false}>
            {row.cells.map((cell, i) => (
              <View key={i} style={[s.td, { flex: cols[i]!.flex }]}>
                <Text style={cols[i]!.right ? s.right : {}}>{cell.main}</Text>
                {cell.sub && <Text style={[s.small, cols[i]!.right ? s.right : {}]}>{cell.sub}</Text>}
              </View>
            ))}
          </View>
        ))}

        <View style={s.below} wrap={false}>
          <View style={s.words}>
            <Text>
              <Text style={s.bold}>In words: </Text>
              {amountInWords(invoice.netTotal)}
            </Text>
            {invoice.note && (
              <View style={{ marginTop: 10 }}>
                <Text style={s.label}>NOTE</Text>
                <Text>{invoice.note}</Text>
              </View>
            )}
          </View>
          <View style={s.totals}>
            <Total label={invoice.linesLabel} value={formatMoney(invoice.subtotal)} />
            {invoice.discount !== "0.00" && (
              <Total label="Discount" value={`- ${formatMoney(invoice.discount)}`} />
            )}
            {invoice.serviceCharge !== "0.00" && (
              <Total label="Service charge" value={formatMoney(invoice.serviceCharge)} />
            )}
            {invoice.vat !== "0.00" && <Total label="VAT" value={formatMoney(invoice.vat)} />}
            <Total label="Net total" value={`BDT ${formatMoney(invoice.netTotal)}`} strong />
            <Total label="Paid" value={formatMoney(invoice.paidAmount)} />
            <Total
              label="Balance due"
              value={`BDT ${formatMoney(invoice.due)}`}
              strong
              color={invoice.due === "0.00" ? undefined : "#b42318"}
            />
          </View>
        </View>

        {terms && (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={s.label}>TERMS AND CONDITIONS</Text>
            <Text style={s.small}>{terms}</Text>
          </View>
        )}

        <View style={s.signRow} wrap={false}>
          <View style={s.sign}>
            <Text style={s.signLine}>Client signature</Text>
          </View>
          <View style={s.sign}>
            {branding.seal && <Image style={s.seal} src={branding.seal} />}
            <Text style={s.signLine}>Authorised signature</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${footer ? `${footer}   ·   ` : ""}Page ${pageNumber} of ${totalPages}`
            }
          />
          {options.showPoweredBy && <Text>Powered by scaleB Insider</Text>}
        </View>
      </Page>
    </Document>
  );
}
