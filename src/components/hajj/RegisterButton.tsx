"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, DatePicker, Form, Input, Modal } from "antd";
import type { ButtonProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { applyActionResult } from "@/components/formResult";
import { registerPilgrimAction } from "@/app/(app)/hajj/actions";

/** Marks a pilgrim registered with the registration number and date. */
export function RegisterButton({
  pilgrimId,
  name,
  trackingNo,
  today,
  buttonProps,
}: {
  pilgrimId: string;
  name: string;
  trackingNo: string | null;
  today: string;
  buttonProps?: ButtonProps;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{
    regNo: string;
    regDate: Dayjs;
    voucherNo?: string;
    trackingNo?: string;
  }>();

  async function confirm() {
    const v = await form.validateFields();
    setSaving(true);
    const result = await registerPilgrimAction(pilgrimId, {
      ...v,
      regDate: v.regDate.format("YYYY-MM-DD"),
    });
    setSaving(false);
    if (applyActionResult(result, form, message, `${name} registered`)) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button type="primary" {...buttonProps} onClick={() => setOpen(true)}>
        Register
      </Button>
      <Modal
        open={open}
        title={`Register ${name}`}
        okText="Register"
        okButtonProps={{ loading: saving }}
        onOk={confirm}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          preserve={false}
          initialValues={{ regDate: dayjs(today), trackingNo: trackingNo ?? undefined }}
        >
          <Form.Item
            label="Registration no."
            name="regNo"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input maxLength={30} autoFocus style={{ textTransform: "uppercase" }} />
          </Form.Item>
          <Form.Item
            label="Registration date"
            name="regDate"
            rules={[{ required: true, message: "Required" }]}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
          </Form.Item>
          <Form.Item label="Voucher no." name="voucherNo">
            <Input maxLength={30} style={{ textTransform: "uppercase" }} />
          </Form.Item>
          <Form.Item label="Tracking no." name="trackingNo">
            <Input maxLength={30} style={{ textTransform: "uppercase" }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
