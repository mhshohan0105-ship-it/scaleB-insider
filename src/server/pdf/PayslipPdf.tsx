// Printable payslip (PLAN.md 6.11).
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import type { PayrollView } from "@/server/services/payroll/payrollService";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import { AgencyHeader, TotalLine, styles } from "./layout";

function monthLabel(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PayslipPdf({
  payroll: p,
  agency,
}: {
  payroll: PayrollView;
  agency: AgencyProfile;
}) {
  const line = (label: string, value: string, key: string) => (
    <View
      key={key}
      style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}
    >
      <Text>{label}</Text>
      <Text>{formatMoney(value)}</Text>
    </View>
  );
  return (
    <Document title={`Payslip ${p.number}`} author={agency.name}>
      <Page size="A5" style={styles.page}>
        {p.status === "VOID" && <Text style={styles.stamp}>VOID</Text>}
        <AgencyHeader
          agency={agency}
          title="PAYSLIP"
          meta={
            <>
              <Text style={styles.docMeta}>{p.number}</Text>
              <Text style={[styles.docMeta, styles.muted]}>{monthLabel(p.month)}</Text>
              <Text style={[styles.docMeta, styles.muted]}>Paid {formatDate(p.date)}</Text>
            </>
          }
        />
        <Text style={styles.bold}>{p.employee.name}</Text>
        <Text style={styles.muted}>
          {[p.employee.designation, p.employee.department].filter(Boolean).join(" · ") || " "}
        </Text>

        <View style={{ flexDirection: "row", marginTop: 14, gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>Earnings</Text>
            {line("Basic salary", p.basic, "basic")}
            {p.allowances.map((a, i) => line(a.name, a.amount, `a${i}`))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>Deductions</Text>
            {p.deductions.map((a, i) => line(a.name, a.amount, `d${i}`))}
            {p.advanceAdjusted !== "0.00" && line("Advance recovered", p.advanceAdjusted, "adv")}
            {p.deductions.length === 0 && p.advanceAdjusted === "0.00" && (
              <Text style={styles.muted}>None</Text>
            )}
          </View>
        </View>

        <View style={styles.totals}>
          <TotalLine label="Gross" value={formatMoney(p.gross)} />
          <TotalLine label="Total deductions" value={formatMoney(p.totalDeductions)} />
          <TotalLine label="Net paid" value={`BDT ${formatMoney(p.netPaid)}`} strong />
        </View>
        <Text style={styles.words}>In words: {amountInWords(p.netPaid)}</Text>
        <Text style={[styles.muted, { marginTop: 6 }]}>Paid from {p.moneyAccount}</Text>

        <View style={styles.signatures}>
          <Text style={styles.signature}>Employee signature</Text>
          <Text style={styles.signature}>Authorised signature</Text>
        </View>
      </Page>
    </Document>
  );
}
