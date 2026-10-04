"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Form, Input, Modal, Typography } from "antd";
import type { ButtonProps } from "antd";
import type { ActionResult } from "@/lib/actionResult";
import { applyActionResult } from "./formResult";

interface VoidButtonProps {
  /** e.g. "invoice AIT-2026-00001" */
  what: string;
  description?: string;
  onVoid: (values: { reason: string }) => Promise<ActionResult<unknown>>;
  buttonProps?: ButtonProps;
  label?: string;
}

/** Void with a mandatory reason. The document stays on record, marked void. */
export function VoidButton({
  what,
  description,
  onVoid,
  buttonProps,
  label = "Void",
}: VoidButtonProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();

  async function confirm() {
    const values = await form.validateFields();
    setSaving(true);
    const result = await onVoid(values);
    setSaving(false);
    if (applyActionResult(result, form, message, `Voided ${what}`)) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button danger {...buttonProps} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        title={`Void ${what}`}
        okText="Void"
        okButtonProps={{ danger: true, loading: saving }}
        onOk={confirm}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <Typography.Paragraph>
          {description ?? "Its ledger entry is reversed. The record stays, marked void."}
        </Typography.Paragraph>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="Reason"
            name="reason"
            rules={[{ required: true, min: 3, message: "Give a reason (at least 3 characters)" }]}
          >
            <Input.TextArea rows={2} maxLength={500} autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
