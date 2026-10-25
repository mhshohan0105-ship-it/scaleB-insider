// Public invoice verification (the QR code on printed invoices). The QR holds
// a random token, never the invoice id; the page shows only what proves the
// invoice is genuine: agency, number, date, amounts and status. No passenger,
// passport or contact details.
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { invoiceDue } from "./invoiceCommon";

export function newPublicToken(): string {
  return randomBytes(15).toString("base64url"); // 20 characters
}

function appUrl(): string {
  return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function verifyUrl(token: string): string {
  return `${appUrl()}/verify/${token}`;
}

/**
 * The invoice's verification token, created on first print for invoices made
 * before tokens existed. A technical field (not business data), so no audit entry.
 */
export async function ensurePublicToken(ctx: ServiceContext, invoiceId: string): Promise<string> {
  const db = tenantDb(ctx.agencyId);
  const inv = await db.invoice.findFirst({ where: { id: invoiceId }, select: { publicToken: true } });
  if (inv?.publicToken) return inv.publicToken;
  const token = newPublicToken();
  await db.invoice.updateMany({ where: { id: invoiceId, publicToken: null }, data: { publicToken: token } });
  const again = await db.invoice.findFirst({ where: { id: invoiceId }, select: { publicToken: true } });
  return again?.publicToken ?? token;
}

/** PNG of the QR code for a verification link. */
export function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 0,
    width: 240,
    color: { dark: "#18211f", light: "#ffffff" },
  });
}

/**
 * Pre-tenant lookup by token (the visitor is not signed in): the token itself
 * is the authorisation, so this reads with the base client.
 */
export async function getPublicInvoice(token: string) {
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(token)) return null;
  const inv = await prisma.invoice.findUnique({
    where: { publicToken: token },
    select: {
      number: true,
      date: true,
      netTotal: true,
      paidAmount: true,
      refundCredit: true,
      status: true,
      agency: { select: { name: true, phone: true, email: true, website: true, status: true } },
    },
  });
  if (!inv || inv.status === "DRAFT" || inv.agency.status === "SUSPENDED") return null;
  return {
    number: inv.number,
    date: inv.date.toISOString().slice(0, 10),
    netTotal: inv.netTotal.toFixed(2),
    paid: inv.paidAmount.toFixed(2),
    due: inv.status === "VOID" ? "0.00" : invoiceDue(inv).toFixed(2),
    status: inv.status,
    agency: {
      name: inv.agency.name,
      phone: inv.agency.phone,
      email: inv.agency.email,
      website: inv.agency.website,
    },
  };
}
