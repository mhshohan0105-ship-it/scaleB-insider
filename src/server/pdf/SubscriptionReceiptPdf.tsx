// Receipt for a subscription payment, issued by whoever runs the installation.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import { SUBSCRIPTION_METHOD_OPTIONS } from "@/lib/schemas/subscriptionPayment";
import type { SubscriptionReceipt } from "@/server/services/subscription/paymentService";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import { AgencyHeader, styles } from "./layout";

const METHOD = Object.fromEntries(SUBSCRIPTION_METHOD_OPTIONS.map((o) => [o.value, o.label]));

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 5 }}>
      <Text style={[styles.muted, { width: 120 }]}>{label}</Text>
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

export function SubscriptionReceiptPdf({
  payment,
  issuer,
  planName,
}: {
  payment: SubscriptionReceipt;
  issuer: AgencyProfile;
  planName: string;
}) {
  return (
    <Document title={`Subscription receipt ${payment.number}`} author={issuer.name}>
      <Page size="A5" orientation="landscape" style={styles.page}>
        {payment.status === "VOID" && (
          <Text style={[styles.stamp, { top: 150, left: 170 }]}>VOID</Text>
        )}
        <AgencyHeader
          agency={issuer}
          title="RECEIPT"
          meta={
            <>
              <Text style={styles.docMeta}>{payment.number}</Text>
              <Text style={[styles.docMeta, styles.muted]}>Date: {formatDate(payment.date)}</Text>
            </>
          }
        />
        <Row
          label="Received from"
          value={`${payment.agency.name} (agency code ${payment.agency.code})`}
        />
        <Row label="Amount" value={`BDT ${formatMoney(payment.amount)}`} />
        <Row label="In words" value={amountInWords(payment.amount)} />
        <Row
          label="For"
          value={`scaleB Insider, ${planName} plan, ${payment.months} month${payment.months === 1 ? "" : "s"}`}
        />
        <Row
          label="Period"
          value={`${formatDate(payment.periodFrom)} to ${formatDate(payment.periodTo)}`}
        />
        <Row
          label="Paid by"
          value={`${METHOD[payment.method] ?? payment.method}${payment.reference ? ` · Ref ${payment.reference}` : ""}`}
        />
        {payment.note && <Row label="Note" value={payment.note} />}
        <View style={[styles.signatures, { marginTop: 36 }]}>
          <Text style={styles.signature}>Received by</Text>
          <Text style={styles.signature}>Authorised signature</Text>
        </View>
      </Page>
    </Document>
  );
}
