import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Inter from the npm package: the build and the running server never call out.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "scaleB Insider",
  description: "Travel agency management and accounting",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
