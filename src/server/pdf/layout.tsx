// Shared building blocks for printable documents (react-pdf).
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { AgencyProfile } from "@/server/services/settings/settingsService";

export const BRAND = "#0e7c6b";
export const MUTED = "#6b7280";

export const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  agencyName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BRAND, marginBottom: 3 },
  muted: { color: MUTED },
  docTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "right", letterSpacing: 1 },
  docMeta: { textAlign: "right", marginTop: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: BRAND, marginBottom: 12 },
  sectionLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 0.5, borderColor: "#d1d5db", marginTop: 8 },
  th: {
    flexDirection: "row",
    backgroundColor: "#f0f7f6",
    borderBottomWidth: 0.5,
    borderColor: "#d1d5db",
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#e5e7eb" },
  cell: { padding: 5 },
  right: { textAlign: "right" },
  totals: { marginLeft: "auto", width: 230, marginTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grand: { borderTopWidth: 1, borderColor: "#111827", marginTop: 3, paddingTop: 4 },
  words: { marginTop: 10, fontFamily: "Helvetica-Oblique" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
  },
  stamp: {
    position: "absolute",
    top: 300,
    left: 150,
    fontSize: 72,
    color: "#dc2626",
    opacity: 0.18,
    transform: "rotate(-30deg)",
    fontFamily: "Helvetica-Bold",
  },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  signature: {
    width: 160,
    borderTopWidth: 0.5,
    borderColor: "#9ca3af",
    paddingTop: 4,
    textAlign: "center",
    color: MUTED,
  },
});

export function AgencyHeader({
  agency,
  title,
  meta,
}: {
  agency: AgencyProfile;
  title: string;
  meta: ReactNode;
}) {
  return (
    <>
      <View style={styles.header}>
        <View style={{ maxWidth: 300 }}>
          <Text style={styles.agencyName}>{agency.name}</Text>
          {agency.address && <Text style={styles.muted}>{agency.address}</Text>}
          <Text style={styles.muted}>
            {[agency.phone, agency.email].filter(Boolean).join("  ·  ")}
          </Text>
          {(agency.iataNo || agency.tradeLicense) && (
            <Text style={styles.muted}>
              {[
                agency.iataNo && `IATA ${agency.iataNo}`,
                agency.tradeLicense && `Trade licence ${agency.tradeLicense}`,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          )}
        </View>
        <View>
          <Text style={styles.docTitle}>{title}</Text>
          {meta}
        </View>
      </View>
      <View style={styles.rule} />
    </>
  );
}

export function TotalLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={[styles.totalRow, strong ? styles.grand : {}]}>
      <Text style={strong ? styles.bold : undefined}>{label}</Text>
      <Text style={strong ? styles.bold : undefined}>{value}</Text>
    </View>
  );
}
