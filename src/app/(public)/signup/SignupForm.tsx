"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Alert, App, Button, Card, Checkbox, Col, Form, Input, Row, Space, Typography } from "antd";
import { TRIAL_DAYS } from "@/lib/subscription";
import type { SignupInput } from "@/lib/schemas/signup";
import { applyActionResult } from "@/components/formResult";
import { requestSignupCodeAction, signUpAction } from "./actions";

/** Agency code from the agency name: "Sky Line Travels" -> "skyline". */
function codeFrom(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(travels?|tours?|and|&|ltd|limited|bd)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
}

export function SignupForm({ needsCode }: { needsCode: boolean }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<SignupInput>();
  const [pending, startTransition] = useTransition();
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string>();

  function sendCode() {
    setError(undefined);
    startTransition(async () => {
      const phone = await form
        .validateFields(["phone"])
        .then((v) => v.phone)
        .catch(() => null);
      if (!phone) return;
      const r = await requestSignupCodeAction({ phone });
      if (applyActionResult(r, form, message, "Code sent by SMS")) setCodeSent(true);
      else setError(r.ok ? undefined : r.error);
    });
  }

  function submit(values: SignupInput) {
    setError(undefined);
    startTransition(async () => {
      const r = await signUpAction(values);
      if (!applyActionResult(r, form, message)) {
        setError(r.ok ? undefined : r.error);
        return;
      }
      // Full load: the app starts with the new owner's session.
      window.location.assign("/dashboard");
    });
  }

  return (
    <div className="pub-form">
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Start your free trial
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {TRIAL_DAYS} days with every feature. No card needed. Already have an agency?{" "}
        <Link href="/login">Sign in</Link>.
      </Typography.Paragraph>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Card>
        <Form<SignupInput>
          form={form}
          name="signup"
          layout="vertical"
          requiredMark="optional"
          onFinish={submit}
          onValuesChange={(changed: Partial<SignupInput>) => {
            if (changed.agencyName !== undefined && !form.isFieldTouched("code"))
              form.setFieldValue("code", codeFrom(changed.agencyName));
          }}
        >
          <Form.Item
            label="Agency name"
            name="agencyName"
            rules={[{ required: true, min: 2, message: "Enter the agency name" }]}
          >
            <Input maxLength={120} placeholder="e.g. Skyline Travels" />
          </Form.Item>
          <Form.Item
            label="Agency code"
            name="code"
            extra="Your team types this to sign in. Lowercase letters, digits and dashes."
            rules={[
              { required: true, message: "Choose an agency code" },
              {
                pattern: /^[a-z0-9][a-z0-9-]{1,38}$/,
                message: "2 to 39 lowercase letters, digits or dashes",
              },
            ]}
          >
            <Input maxLength={39} placeholder="e.g. skyline" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Your name"
                name="ownerName"
                rules={[{ required: true, min: 2, message: "Enter your name" }]}
              >
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ type: "email", message: "Enter a valid email" }]}
              >
                <Input maxLength={120} placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Mobile"
            required
            extra={needsCode ? "We send a 6 digit code to this number." : undefined}
          >
            <Space.Compact block>
              <Form.Item
                name="phone"
                noStyle
                rules={[
                  { required: true, message: "Enter your mobile number" },
                  { pattern: /^(\+?88)?01[3-9]\d{8}$/, message: "Like 01XXXXXXXXX" },
                ]}
              >
                <Input maxLength={14} placeholder="01XXXXXXXXX" inputMode="tel" />
              </Form.Item>
              {needsCode && (
                <Button onClick={sendCode} loading={pending && !codeSent}>
                  {codeSent ? "Send again" : "Send code"}
                </Button>
              )}
            </Space.Compact>
          </Form.Item>
          {needsCode && (
            <Form.Item
              label="Code from SMS"
              name="otp"
              rules={[
                { required: true, message: "Enter the 6 digit code" },
                { pattern: /^\d{6}$/, message: "6 digits" },
              ]}
            >
              <Input maxLength={6} inputMode="numeric" disabled={!codeSent} />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Username"
                name="username"
                rules={[
                  { required: true, message: "Choose a username" },
                  {
                    pattern: /^[a-z0-9._-]{3,60}$/,
                    message: "3+ lowercase letters, digits, . _ -",
                  },
                ]}
              >
                <Input maxLength={60} autoComplete="username" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, min: 8, message: "At least 8 characters" },
                  { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: "Use letters and numbers" },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </Col>
          </Row>
          {/* Hidden from people; bots that fill every field are refused. */}
          <Form.Item name="website" hidden>
            <Input tabIndex={-1} autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="acceptTerms"
            valuePropName="checked"
            rules={[
              {
                validator: (_, v) =>
                  v ? Promise.resolve() : Promise.reject(new Error("Please accept to continue")),
              },
            ]}
          >
            <Checkbox>
              I agree to the{" "}
              <Link href="/terms" target="_blank">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank">
                Privacy Policy
              </Link>
              .
            </Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={pending}>
            Create my agency
          </Button>
        </Form>
      </Card>
    </div>
  );
}
