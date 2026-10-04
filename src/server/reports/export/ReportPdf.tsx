// Any ReportResult as a printable PDF table.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cellText } from "@/lib/reports/format";
import type { ReportColumn, ReportResult } from "@/lib/reports/types";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import { AgencyHeader, styles } from "@/server/pdf/layout";

const numeric = (c: ReportColumn) =>
  c.type === "money" || c.type === "number" || c.type === "balance";

export function ReportPdf({ report, agency }: { report: ReportResult; agency: AgencyProfile }) {
  const wide = report.columns.length > 6;
  const flex = (c: ReportColumn) => c.width ?? 1;
  return (
    <Document title={report.title} author={agency.name}>
      <Page
        size="A4"
        orientation={wide ? "landscape" : "portrait"}
        style={[styles.page, { fontSize: 8.5 }]}
      >
        <AgencyHeader
          agency={agency}
          title={report.title.toUpperCase().slice(0, 40)}
          meta={
            <>
              {report.subtitle && <Text style={styles.docMeta}>{report.subtitle}</Text>}
              <Text style={[styles.docMeta, styles.muted]}>
                Printed {formatDateTime(new Date())}
              </Text>
            </>
          }
        />
        {report.title.length > 40 && (
          <Text style={[styles.bold, { marginBottom: 6 }]}>{report.title}</Text>
        )}
        {report.summary && (
          <View style={{ flexDirection: "row", gap: 18, marginBottom: 8 }}>
            {report.summary.map((s) => (
              <View key={s.label}>
                <Text style={styles.sectionLabel}>{s.label}</Text>
                <Text style={styles.bold}>
                  {/^-?\d+(\.\d+)?$/.test(s.value) ? formatMoney(s.value) : s.value}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.table}>
          <View style={styles.th} fixed>
            {report.columns.map((c) => (
              <Text
                key={c.key}
                style={[
                  styles.cell,
                  styles.bold,
                  { flex: flex(c) },
                  numeric(c) ? styles.right : {},
                ]}
              >
                {c.title}
              </Text>
            ))}
          </View>
          {report.rows.map((r, i) => {
            const kind = r._kind ?? "row";
            const strong = kind !== "row";
            return (
              <View
                key={i}
                style={[styles.tr, kind === "section" ? { backgroundColor: "#f3f4f6" } : {}]}
                wrap={false}
              >
                {report.columns.map((c, ci) => (
                  <Text
                    key={c.key}
                    style={[
                      styles.cell,
                      { flex: flex(c) },
                      numeric(c) ? styles.right : {},
                      strong ? styles.bold : {},
                      ci === 0 && r._level ? { paddingLeft: 5 + r._level * 10 } : {},
                    ]}
                  >
                    {cellText(c, r[c.key])}
                  </Text>
                ))}
              </View>
            );
          })}
          {report.totals && (
            <View style={[styles.tr, { backgroundColor: "#f0f7f6" }]} wrap={false}>
              {report.columns.map((c) => (
                <Text
                  key={c.key}
                  style={[
                    styles.cell,
                    styles.bold,
                    { flex: flex(c) },
                    numeric(c) ? styles.right : {},
                  ]}
                >
                  {cellText(c, report.totals![c.key])}
                </Text>
              ))}
            </View>
          )}
        </View>
        {report.rows.length === 0 && (
          <Text style={[styles.muted, { marginTop: 10 }]}>No records.</Text>
        )}
        {(report.notes ?? []).map((n) => (
          <Text key={n} style={[styles.muted, { marginTop: 6 }]}>
            {n}
          </Text>
        ))}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${agency.name}  ·  ${report.title}  ·  Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
