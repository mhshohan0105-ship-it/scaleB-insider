import type { Metadata } from "next";
import { PublicFrame } from "@/components/public/PublicFrame";
import { GRACE_DAYS, TRIAL_DAYS } from "@/lib/subscription";
import { platformAgency } from "@/server/services/subscription/subscriptionService";

export const metadata: Metadata = { title: "Terms of Service | scaleB Insider" };
export const dynamic = "force-dynamic";

const UPDATED = "7 November 2026";

export default async function TermsPage() {
  const contact = await platformAgency();
  const us = contact?.name ?? "scaleB";
  return (
    <PublicFrame contact={contact}>
      <article className="pub-doc">
        <h1>Terms of Service</h1>
        <p style={{ color: "#4a5a56" }}>Last updated {UPDATED}</p>

        <p>
          These terms are an agreement between {us} (&quot;we&quot;) and the travel agency that
          opens an account on scaleB Insider (&quot;you&quot;). By signing up or using the service
          you accept them on behalf of your agency.
        </p>

        <h2>1. The service</h2>
        <p>
          scaleB Insider is online software for running a travel agency: invoices, refunds,
          receipts, payments, accounts and reports. We host it, keep it running, back it up and
          improve it. Features may change over time; we will not remove a core feature you pay for
          during a paid period without telling you first.
        </p>

        <h2>2. Your account</h2>
        <p>
          You choose an agency code and an owner account. You decide who else gets a user and what
          each role may do, and you are responsible for everything done with your users&apos;
          sign-ins. Keep passwords private and tell us at once if you think one has been misused.
        </p>

        <h2>3. Trial, plans and payment</h2>
        <p>
          A new agency gets a free trial of {TRIAL_DAYS} days. After that you need a paid plan. A
          plan has a price, a number of active users and a set of modules, shown on your
          Subscription page. You pay in advance for a month or a year by the methods we accept. If a
          payment is late you keep full use for {GRACE_DAYS} days; after that the account becomes
          view only until it is renewed. Payments are not refunded for a period already started,
          unless the law requires it.
        </p>

        <h2>4. Your data</h2>
        <p>
          The records you enter belong to you. We use them only to provide the service, as described
          in the Privacy Policy. You can export your data at any time, including while your account
          is view only. If you close your account, we keep your data for 90 days so you can come
          back or take a copy, and then delete it, except backups that expire on their own schedule.
        </p>

        <h2>5. Fair use</h2>
        <p>
          Do not use the service for anything unlawful, to store data you have no right to hold, to
          send unsolicited messages, or to try to reach other agencies&apos; data or disrupt the
          service. We may suspend an account that does, after telling you why when we can.
        </p>

        <h2>6. Availability and support</h2>
        <p>
          We aim to keep the service available at all times, but maintenance and events outside our
          control can interrupt it. We back up the database every night. Support is given by phone
          and email during business hours in Bangladesh.
        </p>

        <h2>7. Liability</h2>
        <p>
          The service helps you keep accurate books, but you remain responsible for your figures,
          your tax filings and your dealings with clients, airlines and other suppliers. To the
          extent the law allows, our total liability for any claim is limited to what you paid us in
          the three months before it arose, and we are not liable for indirect losses such as lost
          profit.
        </p>

        <h2>8. Changes and ending</h2>
        <p>
          We may update these terms; we will show the new date here and tell you of important
          changes. You may stop using the service at any time. These terms are governed by the laws
          of Bangladesh.
        </p>

        <h2>Contact</h2>
        <p>
          {us}
          {contact?.phone && ` · ${contact.phone}`}
          {contact?.email && ` · ${contact.email}`}
        </p>
      </article>
    </PublicFrame>
  );
}
