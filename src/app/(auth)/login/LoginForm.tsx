"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Form, Input, Typography } from "antd";
import { BankOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";
import type { LoginInput } from "@/lib/schemas/auth";
import { loginAction } from "./actions";

interface AgencyCard {
  name: string;
  logo: string | null;
}

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [agency, setAgency] = useState<AgencyCard | null>(null);

  /** Shows whose sign-in this is once the agency code is typed. */
  async function lookUp(code: string) {
    const c = code.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(c)) return setAgency(null);
    const r = await fetch(`/api/public/agency?code=${encodeURIComponent(c)}`).catch(() => null);
    setAgency(r?.ok ? ((await r.json()) as AgencyCard) : null);
  }

  function onFinish(values: LoginInput) {
    setError(undefined);
    startTransition(async () => {
      const result = await loginAction(values);
      if (result.error) {
        setError(result.error);
        return;
      }
      // Full page load: the app starts fresh with the new session cookie.
      window.location.assign(callbackUrl);
    });
  }

  return (
    <div className="login-page">
      <section className="login-brand" aria-hidden>
        <div className="login-brand-mark">sB</div>
        <h1>scaleB Insider</h1>
        <p>Tickets, visas, tours, Hajj and Umrah, all posted to one set of books.</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            Sign in
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Use the agency code your administrator gave you.
          </Typography.Paragraph>

          {agency && (
            <div className="login-agency">
              {agency.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agency.logo} alt="" />
              ) : (
                <span className="login-agency-mark">{agency.name.slice(0, 1).toUpperCase()}</span>
              )}
              <span>{agency.name}</span>
            </div>
          )}

          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

          <Form<LoginInput> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
            <Form.Item
              label="Agency code"
              name="agencyCode"
              rules={[{ required: true, message: "Enter your agency code" }]}
            >
              <Input
                prefix={<BankOutlined />}
                autoComplete="organization"
                autoFocus
                onBlur={(e) => void lookUp(e.target.value)}
              />
            </Form.Item>
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: "Enter your username" }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: "Enter your password" }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={pending}>
              Sign in
            </Button>
          </Form>
          <Typography.Paragraph type="secondary" style={{ marginTop: 20, textAlign: "center" }}>
            New agency? <Link href="/signup">Start a free trial</Link>
          </Typography.Paragraph>
        </div>
      </section>
    </div>
  );
}
