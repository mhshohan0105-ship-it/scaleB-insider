import type { Metadata } from "next";
import { HomePage } from "@/components/public/HomePage";
import { platformAgency, publicPlans } from "@/server/services/subscription/subscriptionService";

export const metadata: Metadata = {
  title: "scaleB Insider · Travel agency management and accounting",
  description:
    "Invoices, refunds, receipts, accounts and reports for travel agencies in Bangladesh. Start a free trial.",
};

// Signed-in visitors never see this page: the middleware sends them to /dashboard.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [plans, contact] = await Promise.all([publicPlans(), platformAgency()]);
  return <HomePage plans={plans} contact={contact} />;
}
