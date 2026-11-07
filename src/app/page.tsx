import type { Metadata } from "next";
import localFont from "next/font/local";
import { HomePage } from "@/components/public/HomePage";
import { platformAgency, publicPlans } from "@/server/services/subscription/subscriptionService";

// The rounded face of the ScaleB logo, for headings on the home page.
const display = localFont({
  src: "../../node_modules/@fontsource/comfortaa/files/comfortaa-latin-700-normal.woff2",
  weight: "700",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ScaleB Insider · Travel agency management and accounting",
  description:
    "Invoices, refunds, receipts, accounts and reports for travel agencies in Bangladesh. Start a free trial.",
};

// Signed-in visitors never see this page: the middleware sends them to /dashboard.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [plans, contact] = await Promise.all([publicPlans(), platformAgency()]);
  return (
    <div className={display.variable}>
      <HomePage plans={plans} contact={contact} />
    </div>
  );
}
