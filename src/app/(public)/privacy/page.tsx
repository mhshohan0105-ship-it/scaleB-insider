import type { Metadata } from "next";
import { PublicFrame } from "@/components/public/PublicFrame";
import { platformAgency } from "@/server/services/subscription/subscriptionService";

export const metadata: Metadata = { title: "Privacy Policy | scaleB Insider" };
export const dynamic = "force-dynamic";

const UPDATED = "7 November 2026";

export default async function PrivacyPage() {
  const contact = await platformAgency();
  const us = contact?.name ?? "scaleB";
  return (
    <PublicFrame contact={contact}>
      <article className="pub-doc">
        <h1>Privacy Policy</h1>
        <p style={{ color: "#4a5a56" }}>Last updated {UPDATED}</p>

        <p>
          This policy explains what {us} does with information in scaleB Insider. There are two
          kinds: information about your agency and its users, and the records your agency keeps
          about its own clients, passengers and suppliers.
        </p>

        <h2>What we collect about you</h2>
        <p>
          When you sign up: the agency name, your name, mobile number, email and the username you
          choose. Passwords are stored only as a one-way hash. While you use the service we record
          sign-ins (time, network address and browser) and an audit trail of changes, so you can see
          who did what.
        </p>

        <h2>Your agency&apos;s records</h2>
        <p>
          Clients, passengers, passport details, invoices and payments that you enter are your
          records. We hold and process them only on your instructions, to run the service for you.
          We do not sell them, do not use them for advertising and do not share them with other
          agencies. Each agency&apos;s data is kept apart from every other agency&apos;s.
        </p>

        <h2>How we use information</h2>
        <p>
          To provide and support the service, to send you sign-up codes and service notices, to bill
          for your plan, to keep the service secure, and to meet legal duties. SMS you send to your
          clients from the service go through an SMS gateway only for delivery.
        </p>

        <h2>Who can see it</h2>
        <p>
          Your users, according to the roles you give them. Our staff only when needed to help you
          or keep the service running, for example when you ask for support; such access is recorded
          in your audit log. Hosting and SMS providers process data for us under their own security
          obligations. We disclose information to authorities only when the law requires it.
        </p>

        <h2>Security and backups</h2>
        <p>
          The service runs over encrypted connections. The database is backed up every night; the
          backups are encrypted and kept for a limited time before they are replaced.
        </p>

        <h2>How long we keep it</h2>
        <p>
          While your account is open, and for 90 days after it is closed so you can return or take a
          copy. After that it is deleted, apart from encrypted backups that expire on their own
          schedule and records we must keep by law.
        </p>

        <h2>Your choices</h2>
        <p>
          You can correct your details in the app, export your agency&apos;s data at any time, and
          ask us to close your account and delete its data.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy: {us}
          {contact?.phone && ` · ${contact.phone}`}
          {contact?.email && ` · ${contact.email}`}
        </p>
      </article>
    </PublicFrame>
  );
}
