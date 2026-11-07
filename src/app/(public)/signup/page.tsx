import type { Metadata } from "next";
import { PublicFrame } from "@/components/public/PublicFrame";
import { signupNeedsCode } from "@/server/services/signup/signupService";
import { platformAgency } from "@/server/services/subscription/subscriptionService";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Start a free trial | scaleB Insider" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  return (
    <PublicFrame contact={await platformAgency()}>
      <SignupForm needsCode={signupNeedsCode()} />
    </PublicFrame>
  );
}
