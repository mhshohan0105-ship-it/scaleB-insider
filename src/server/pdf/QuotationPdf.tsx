// Printable quotation (PLAN.md 6.15). Client prices only, never cost.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import type { QuotationView } from "@/server/services/quotations/quotationService";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import { AgencyHeader, TotalLine, styles } from "./layout";

const COLS = [
  { label: "Description", flex: 4 },
  { label: "Qty", flex: 0.8, right: true },
  { label: "Unit price", flex: 1.4, right: true },
  { label: "Amount (BDT)", flex: 1.4, right: true },
];

export function QuotationPdf({
  q,
  agency,
  footer,
}: {
  q: QuotationView;
  agency: AgencyProfile;
  footer: string | null;
}) {
  return (
    <Document title={`Quotation ${q.number}`} author={agency.name}>
      <Page size="A4" style={styles.page}>
        <AgencyHeader
          agency={agency}
          title="QUOTATION"
          meta={
            <>
              <Text style={styles.docMeta}>{q.number}</Text>
              <Text style={[styles.docMeta, styles.muted]}>Date: {formatDate(q.date)}</Text>
              <Text style={[styles.docMeta, styles.muted]}>
                Valid until: {formatDate(q.validUntil)}
              </Text>
            </>
          }
        />
        <Text style={styles.sectionLabel}>Prepared for</Text>
        <Text style={styles.bold}>{q.client.name}</Text>
        {q.client.phone && <Text style={styles.muted}>{q.client.phone}</Text>}
        {q.client.address && <Text style={styles.muted}>{q.client.address}</Text>}
        {q.subject && <Text style={[styles.bold, { marginTop: 10 }]}>{q.subject}</Text>}

        <View style={[styles.table, { marginTop: 12 }]}>
          <View style={styles.th}>
            {COLS.map((c) => (
              <Text
                key={c.label}
                style={[styles.cell, styles.bold, { flex: c.flex }, c.right ? styles.right : {}]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {q.lines.map((l) => (
            <View key={l.id} style={styles.tr} wrap={false}>
              <Text style={[styles.cell, { flex: COLS[0]!.flex }]}>{l.description}</Text>
              <Text style={[styles.cell, styles.right, { flex: COLS[1]!.flex }]}>{l.qty}</Text>
              <Text style={[styles.cell, styles.right, { flex: COLS[2]!.flex }]}>
                {formatMoney(l.unitPrice)}
              </Text>
              <Text style={[styles.cell, styles.right, { flex: COLS[3]!.flex }]}>
                {formatMoney(l.amount)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <TotalLine label="Subtotal" value={formatMoney(q.subtotal)} />
          {q.discount !== "0.00" && (
            <TotalLine label="Discount" value={`- ${formatMoney(q.discount)}`} />
          )}
          <TotalLine label="Total" value={`BDT ${formatMoney(q.netTotal)}`} strong />
        </View>
        <Text style={styles.words}>In words: {amountInWords(q.netTotal)}</Text>

        {q.note && (
          <View style={{ marginTop: 12 }}>
            <Text>{q.note}</Text>
          </View>
        )}
        {q.terms && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionLabel}>Terms and conditions</Text>
            <Text style={styles.muted}>{q.terms}</Text>
          </View>
        )}
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
