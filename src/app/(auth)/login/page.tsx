import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in | scaleB Insider" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={toLocalPath(callbackUrl)} />;
}

/** Reduces any callback (Auth.js passes absolute URLs) to a same-site path. */
function toLocalPath(callbackUrl: string | undefined): string {
  if (!callbackUrl) return "/dashboard";
  try {
    const url = new URL(callbackUrl, "http://local.invalid");
    const path = `${url.pathname}${url.search}`;
    return path.startsWith("/") && !path.startsWith("//") && path !== "/login"
      ? path
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
