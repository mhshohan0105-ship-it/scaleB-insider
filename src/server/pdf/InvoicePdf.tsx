// Printable invoice for every invoice type (PLAN.md 6.1): agency header,
// client, lines, totals, amount in words, paid, due, terms and footer. Shows
// client prices only, never cost or profit.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import type { PdfInvoice } from "./invoiceDocument";
import { AgencyHeader, TotalLine, styles } from "./layout";

export function InvoicePdf({
  invoice,
  agency,
  terms,
  footer,
}: {
  invoice: PdfInvoice;
  agency: AgencyProfile;
  terms: string | null;
  footer: string | null;
}) {
  const stamp = invoice.status === "VOID" ? "VOID" : invoice.status === "DRAFT" ? "DRAFT" : null;
  const cols = invoice.columns;
  return (
    <Document title={`Invoice ${invoice.number}`} author={agency.name}>
      <Page size="A4" style={styles.page}>
        {stamp && <Text style={styles.stamp}>{stamp}</Text>}
        <AgencyHeader
          agency={agency}
          title="INVOICE"
          meta={
            <>
              <Text style={styles.docMeta}>{invoice.number}</Text>
              <Text style={[styles.docMeta, styles.muted]}>{invoice.typeLabel}</Text>
              <Text style={[styles.docMeta, styles.muted]}>Date: {formatDate(invoice.date)}</Text>
              {invoice.dueDate && (
                <Text style={[styles.docMeta, styles.muted]}>
                  Due: {formatDate(invoice.dueDate)}
                </Text>
              )}
            </>
          }
        />

        <Text style={styles.sectionLabel}>Bill to</Text>
        <Text style={styles.bold}>{invoice.client.name}</Text>
        <Text style={styles.muted}>Client code {invoice.client.code}</Text>
        {invoice.client.phone && <Text style={styles.muted}>{invoice.client.phone}</Text>}
        {invoice.client.address && <Text style={styles.muted}>{invoice.client.address}</Text>}
        {invoice.extraMeta.map((m) => (
          <Text key={m} style={styles.muted}>
            {m}
          </Text>
        ))}

        <View style={[styles.table, { marginTop: 14 }]}>
          <View style={styles.th}>
            {cols.map((c) => (
              <Text
                key={c.label}
                style={[styles.cell, styles.bold, { flex: c.flex }, c.right ? styles.right : {}]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {invoice.rows.map((row) => (
            <View key={row.id} style={styles.tr} wrap={false}>
              {row.cells.map((cell, i) => (
                <View key={i} style={[styles.cell, { flex: cols[i]!.flex }]}>
                  <Text style={cols[i]!.right ? styles.right : {}}>{cell.main}</Text>
                  {cell.sub && (
                    <Text style={[styles.muted, cols[i]!.right ? styles.right : {}]}>
                      {cell.sub}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <TotalLine label={invoice.linesLabel} value={formatMoney(invoice.subtotal)} />
          {invoice.discount !== "0.00" && (
            <TotalLine label="Discount" value={`- ${formatMoney(invoice.discount)}`} />
          )}
          {invoice.serviceCharge !== "0.00" && (
            <TotalLine label="Service charge" value={formatMoney(invoice.serviceCharge)} />
          )}
          {invoice.vat !== "0.00" && <TotalLine label="VAT" value={formatMoney(invoice.vat)} />}
          <TotalLine label="Total" value={`BDT ${formatMoney(invoice.netTotal)}`} strong />
          <TotalLine label="Received" value={formatMoney(invoice.paidAmount)} />
          <TotalLine label="Due" value={`BDT ${formatMoney(invoice.due)}`} strong />
        </View>

        <Text style={styles.words}>In words: {amountInWords(invoice.netTotal)}</Text>

        {invoice.note && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionLabel}>Note</Text>
            <Text>{invoice.note}</Text>
          </View>
        )}
        {terms && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionLabel}>Terms and conditions</Text>
            <Text style={styles.muted}>{terms}</Text>
          </View>
        )}

        <View style={styles.signatures}>
          <Text style={styles.signature}>Client signature</Text>
          <Text style={styles.signature}>Authorised signature</Text>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${footer ?? ""}${footer ? "   ·   " : ""}Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
