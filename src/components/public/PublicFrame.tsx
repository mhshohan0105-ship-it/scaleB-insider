"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "antd";

export interface PublicContact {
  name: string;
  phone: string | null;
  email: string | null;
}

/** Header and footer of the public pages (home, sign-up, terms, privacy). */
export function PublicFrame({
  children,
  contact,
}: {
  children: ReactNode;
  /** Who runs this installation, shown in the footer. */
  contact?: PublicContact | null;
}) {
  return (
    <div className="pub">
      <header className="pub-header">
        <div className="pub-wrap">
          <Link href="/" className="pub-logo">
            <span className="pub-logo-mark">sB</span>
            scaleB Insider
          </Link>
          <nav className="pub-nav">
            <Button type="text" href="/#features" className="pub-wide">
              Features
            </Button>
            <Button type="text" href="/#plans" className="pub-wide">
              Plans
            </Button>
            <Button href="/login">Sign in</Button>
            <Button type="primary" href="/signup">
              Free trial
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="pub-footer">
        <div className="pub-wrap">
          <span>
            © {new Date().getFullYear()} {contact?.name ?? "scaleB"}
            {contact?.phone && ` · ${contact.phone}`}
            {contact?.email && ` · ${contact.email}`}
          </span>
          <span>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
