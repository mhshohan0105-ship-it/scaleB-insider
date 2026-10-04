"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Form, Input, Typography } from "antd";
import { BankOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import type { LoginInput } from "@/lib/schemas/auth";
import { loginAction } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

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

          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

          <Form<LoginInput> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
            <Form.Item
              label="Agency code"
              name="agencyCode"
              rules={[{ required: true, message: "Enter your agency code" }]}
            >
              <Input prefix={<BankOutlined />} autoComplete="organization" autoFocus />
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
        </div>
      </section>
    </div>
  );
}
