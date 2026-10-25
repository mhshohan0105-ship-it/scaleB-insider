// Public page behind the QR code on printed invoices (no sign-in).
import type { Metadata } from "next";
import { formatDate, formatMoney } from "@/lib/format";
import { getPublicInvoice } from "@/server/services/invoices/publicInvoice";

export const metadata: Metadata = { title: "Invoice check · scaleB Insider", robots: "noindex" };

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: "Paid", color: "#067647", bg: "#ecfdf3" },
  PARTIAL: { label: "Partly paid", color: "#b54708", bg: "#fffaeb" },
  POSTED: { label: "Payment due", color: "#b42318", bg: "#fef3f2" },
  REFUNDED: { label: "Refunded", color: "#4a5a56", bg: "#eef2f1" },
  VOID: { label: "Cancelled (void)", color: "#4a5a56", bg: "#eef2f1" },
};

export default async function VerifyInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const inv = await getPublicInvoice((await params).token);
  const st = inv ? (STATUS[inv.status] ?? STATUS.POSTED!) : null;
  return (
    <main className="verify-page">
      <div className="verify-card">
        {inv && st ? (
          <>
            <div className="verify-ok">Genuine invoice</div>
            <h1>{inv.agency.name}</h1>
            <p className="verify-muted">
              {[inv.agency.phone, inv.agency.email, inv.agency.website].filter(Boolean).join(" · ")}
            </p>
            <dl>
              <dt>Invoice</dt>
              <dd>{inv.number}</dd>
              <dt>Date</dt>
              <dd>{formatDate(inv.date)}</dd>
              <dt>Total</dt>
              <dd>BDT {formatMoney(inv.netTotal)}</dd>
              <dt>Paid</dt>
              <dd>BDT {formatMoney(inv.paid)}</dd>
              <dt>Due</dt>
              <dd>BDT {formatMoney(inv.due)}</dd>
            </dl>
            <span className="verify-status" style={{ color: st.color, background: st.bg }}>
              {st.label}
            </span>
          </>
        ) : (
          <>
            <div className="verify-bad">Not found</div>
            <h1>We could not find this invoice</h1>
            <p className="verify-muted">
              The code may be mistyped, or the invoice was not issued through scaleB Insider. Ask
              the agency that gave it to you.
            </p>
          </>
        )}
        <p className="verify-foot">Checked by scaleB Insider</p>
      </div>
    </main>
  );
}
