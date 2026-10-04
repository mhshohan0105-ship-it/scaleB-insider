// Printable money receipt (PLAN.md 6.6).
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/schemas/invoices";
import type { MoneyReceiptView } from "@/server/services/payments/receiptService";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import { AgencyHeader, TotalLine, styles } from "./layout";

const METHOD = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label]));

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 5 }}>
      <Text style={[styles.muted, { width: 120 }]}>{label}</Text>
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

export function ReceiptPdf({
  receipt,
  agency,
  footer,
}: {
  receipt: MoneyReceiptView;
  agency: AgencyProfile;
  footer: string | null;
}) {
  return (
    <Document title={`Money receipt ${receipt.number}`} author={agency.name}>
      <Page size="A5" orientation="landscape" style={styles.page}>
        {receipt.status === "VOID" && (
          <Text style={[styles.stamp, { top: 150, left: 170 }]}>VOID</Text>
        )}
        <AgencyHeader
          agency={agency}
          title="MONEY RECEIPT"
          meta={
            <>
              <Text style={styles.docMeta}>{receipt.number}</Text>
              <Text style={[styles.docMeta, styles.muted]}>Date: {formatDate(receipt.date)}</Text>
            </>
          }
        />
        <Row label="Received from" value={`${receipt.client.name} (${receipt.client.code})`} />
        <Row label="Amount" value={`BDT ${formatMoney(receipt.amount)}`} />
        <Row label="In words" value={amountInWords(receipt.amount)} />
        <Row
          label="Paid by"
          value={`${METHOD[receipt.paymentMethod] ?? receipt.paymentMethod}${receipt.reference ? ` · Ref ${receipt.reference}` : ""}`}
        />
        {receipt.allocations.length > 0 && (
          <Row
            label="Against invoices"
            value={receipt.allocations
              .map((a) => `${a.number} (${formatMoney(a.amount)})`)
              .join(", ")}
          />
        )}
        <View style={[styles.totals, { width: 200 }]}>
          <TotalLine label="Applied to invoices" value={formatMoney(receipt.allocated)} />
          <TotalLine label="Kept as advance" value={formatMoney(receipt.advance)} />
        </View>
        {receipt.note && <Row label="Note" value={receipt.note} />}
        <View style={[styles.signatures, { marginTop: 36 }]}>
          <Text style={styles.signature}>Received by</Text>
          <Text style={styles.signature}>Authorised signature</Text>
        </View>
        {footer && (
          <Text style={styles.footer} fixed>
            {footer}
          </Text>
        )}
      </Page>
    </Document>
  );
}
