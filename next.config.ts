import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Sent with every response (SECURITY.md). The app never needs to be framed,
// sniffed, or to use the camera, microphone or location.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Lets the Playwright dev server build into its own folder so it never
  // clobbers a dev server that is already running on .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Self-contained server build for the Docker image only (the Dockerfile sets
  // NEXT_OUTPUT=standalone); Vercel and `next start` use the normal output.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  serverExternalPackages: ["bcryptjs", "@react-pdf/renderer", "exceljs"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
