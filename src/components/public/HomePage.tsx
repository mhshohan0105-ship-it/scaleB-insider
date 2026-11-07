"use client";

import { Button, Collapse, Space, Tag } from "antd";
import {
  AuditOutlined,
  BarChartOutlined,
  FileTextOutlined,
  LockOutlined,
  RollbackOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { TRIAL_DAYS } from "@/lib/subscription";
import type { PublicPlan } from "@/server/services/subscription/subscriptionService";
import { PublicFrame, type PublicContact } from "./PublicFrame";

const FEATURES = [
  {
    icon: <FileTextOutlined />,
    title: "Invoices for every service",
    text: "Air tickets with commission and AIT worked out, visas, tours, Hajj, Umrah and anything else you sell, printed with your logo and a QR check.",
  },
  {
    icon: <RollbackOutlined />,
    title: "Reissues and refunds",
    text: "Reissue a ticket or refund it with airline and agency charges; the client, the vendor and your profit are corrected on their own.",
  },
  {
    icon: <AuditOutlined />,
    title: "Accounts that balance",
    text: "Every sale, receipt, payment and expense is posted by double entry, so client dues, vendor dues and cash always agree.",
  },
  {
    icon: <BarChartOutlined />,
    title: "Reports you can trust",
    text: "Sales, profit, dues, ledgers, airline and salesman reports, trial balance and balance sheet, ready to export.",
  },
  {
    icon: <TeamOutlined />,
    title: "Your team, your rules",
    text: "Add staff with roles that decide what each person may see and do. Every change is recorded with who made it.",
  },
  {
    icon: <LockOutlined />,
    title: "Your data stays yours",
    text: "Each agency's data is kept apart, backed up every night in encrypted form, and can be exported at any time.",
  },
];

const FAQ = [
  {
    q: "Do I need a card to start the trial?",
    a: `No. Sign up with your mobile number and use everything for ${TRIAL_DAYS} days.`,
  },
  {
    q: "What happens when the trial ends?",
    a: "Nothing is deleted. You can still see and export everything; adding new records starts again once you choose a plan.",
  },
  {
    q: "How do I pay?",
    a: "By bKash, bank transfer or cash. Contact us with the plan you want; your account is renewed as soon as the payment is received.",
  },
  {
    q: "Can I bring my old balances?",
    a: "Yes. Clients, vendors, agents and accounts take an opening balance, so you start with the dues you already have.",
  },
];

export function HomePage({
  plans,
  contact,
}: {
  plans: PublicPlan[];
  contact: PublicContact | null;
}) {
  return (
    <PublicFrame contact={contact}>
      <section className="pub-hero">
        <div className="pub-wrap">
          <Tag color="rgba(255,255,255,0.14)" style={{ marginBottom: 18, color: "#e6f4f1" }}>
            Travel agency software for Bangladesh
          </Tag>
          <h1>Run your travel agency on one set of books.</h1>
          <p>
            Tickets, visas, tours, Hajj and Umrah, refunds, receipts and payments in one place, with
            accounts that balance and reports you can trust.
          </p>
          <Space wrap>
            <Button
              type="primary"
              size="large"
              href="/signup"
              style={{ background: "#ffffff", color: "#0c3b34" }}
            >
              Start {TRIAL_DAYS} day free trial
            </Button>
            <Button size="large" ghost href="/login">
              Sign in
            </Button>
          </Space>
        </div>
      </section>

      <section className="pub-section" id="features">
        <div className="pub-wrap">
          <h2>Everything an agency does in a day</h2>
          <p className="pub-lead">
            From the first quote to the vendor payment, without spreadsheets.
          </p>
          <div className="pub-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="pub-card">
                {f.icon}
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="pub-section alt" id="plans">
          <div className="pub-wrap">
            <h2>Plans</h2>
            <p className="pub-lead">
              Every plan starts with a {TRIAL_DAYS} day free trial. Change plan whenever you need.
            </p>
            <div className="pub-grid">
              {plans.map((p) => (
                <div key={p.code} className="pub-card">
                  <h3 style={{ marginTop: 0 }}>{p.name}</h3>
                  <div className="pub-price">
                    {p.priceLine ? p.priceLine.split(" or ")[0] : "Ask us"}
                  </div>
                  {p.priceLine.includes(" or ") && (
                    <p style={{ marginBottom: 8 }}>or {p.priceLine.split(" or ")[1]}</p>
                  )}
                  <p>
                    {p.maxUsers ? `Up to ${p.maxUsers} users` : "Unlimited users"} ·{" "}
                    {p.modules.length ? `${p.modules.length} modules` : "every module"}
                  </p>
                  <Button type="primary" block href="/signup" style={{ marginTop: 16 }}>
                    Start free trial
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pub-section">
        <div className="pub-wrap" style={{ maxWidth: 760 }}>
          <h2>Questions</h2>
          <Collapse
            style={{ marginTop: 16 }}
            items={FAQ.map((f, i) => ({
              key: String(i),
              label: f.q,
              children: <p style={{ margin: 0 }}>{f.a}</p>,
            }))}
          />
        </div>
      </section>
    </PublicFrame>
  );
}
