"use client";

import { useTransition } from "react";
import { App, Button, Card, Form, Input } from "antd";
import type { ChangePasswordInput } from "@/lib/schemas/users";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { changePasswordAction } from "../actions";

export function ChangePasswordForm() {
  const [form] = Form.useForm<ChangePasswordInput>();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  function onFinish(values: ChangePasswordInput) {
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (applyActionResult(result, form, message, "Password changed")) form.resetFields();
    });
  }

  return (
    <>
      <PageHeader title="Change password" />
      <Card style={{ maxWidth: 480 }}>
        <Form<ChangePasswordInput> form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Current password"
            name="currentPassword"
            rules={[{ required: true, message: "Enter your current password" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="New password"
            name="newPassword"
            rules={[{ required: true, message: "Enter a new password" }]}
            extra="At least 8 characters, with letters and numbers."
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Repeat the new password" },
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  !v || v === getFieldValue("newPassword")
                    ? Promise.resolve()
                    : Promise.reject(new Error("Passwords do not match")),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={pending}>
            Change password
          </Button>
        </Form>
      </Card>
    </>
  );
}
