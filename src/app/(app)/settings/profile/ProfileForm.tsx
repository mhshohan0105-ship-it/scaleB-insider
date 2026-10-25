"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Col, Form, Input, Row, Space, Switch, Tag, Typography, Upload } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { saveProfileAction } from "../actions";

export function ProfileForm({ initial, canEdit }: { initial: AgencyProfile; canEdit: boolean }) {
  const [form] = Form.useForm<AgencyProfile>();
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onFinish(values: AgencyProfile) {
    startTransition(async () => {
      const result = await saveProfileAction(values);
      if (applyActionResult(result, form, message, "Agency profile saved")) router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="Agency Profile"
        description="Printed on invoices, receipts and reports."
        extra={<Tag>Login code: {initial.code}</Tag>}
      />
      <Card>
        <Form<AgencyProfile>
          form={form}
          layout="vertical"
          initialValues={initial}
          onFinish={onFinish}
          disabled={!canEdit}
          style={{ maxWidth: 820 }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Agency name"
                name="name"
                rules={[{ required: true, message: "Agency name is required" }]}
              >
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Phone" name="phone">
                <Input maxLength={30} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ type: "email", message: "Enter a valid email" }]}
              >
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Website" name="website">
                <Input maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Address" name="address">
                <Input.TextArea rows={2} maxLength={300} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Trade licence no." name="tradeLicense">
                <Input maxLength={60} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="IATA no." name="iataNo">
                <Input maxLength={30} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Facebook page" name="facebook">
                <Input maxLength={200} placeholder="facebook.com/your-page" />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Title level={5} style={{ marginTop: 8 }}>
            Printed documents
          </Typography.Title>
          <Row gutter={16}>
            {PDF_SWITCHES.map((s) => (
              <Col xs={24} md={12} key={s.name}>
                <Form.Item name={["pdf", s.name]} label={s.label} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            ))}
          </Row>
          {canEdit && (
            <Button type="primary" htmlType="submit" loading={pending}>
              Save profile
            </Button>
          )}
        </Form>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16, maxWidth: 852 }}>
        <Col xs={24} md={12}>
          <ImageCard
            kind="logo"
            title="Logo"
            hint="PNG or JPG, up to 1 MB. A wide logo (about 3:1) prints best."
            changed={initial.images.LOGO}
            canEdit={canEdit}
          />
        </Col>
        <Col xs={24} md={12}>
          <ImageCard
            kind="seal"
            title="Seal or signature"
            hint="Printed above Authorised signature. PNG with a transparent background looks best."
            changed={initial.images.SEAL}
            canEdit={canEdit}
          />
        </Col>
      </Row>
    </>
  );
}

const PDF_SWITCHES = [
  { name: "showQr", label: "QR code to verify the invoice" },
  { name: "showStamp", label: "PAID / DUE / PARTIAL stamp" },
  { name: "showPassports", label: "Passengers and passports table" },
  { name: "showPoweredBy", label: "“Powered by scaleB Insider” footer" },
] as const;

function ImageCard({
  kind,
  title,
  hint,
  changed,
  canEdit,
}: {
  kind: "logo" | "seal";
  title: string;
  hint: string;
  changed: string | null;
  canEdit: boolean;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const url = `/api/settings/images/${kind}`;

  async function upload(file: File) {
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(url, { method: "POST", body });
    setBusy(false);
    if (res.ok) {
      message.success(`${title} saved`);
      router.refresh();
    } else message.error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed");
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(url, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else message.error("Could not remove the image");
  }

  return (
    <Card title={title} style={{ height: "100%" }}>
      <div
        style={{
          height: 120,
          border: "1px dashed #d5dfdc",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbfcfc",
          marginBottom: 12,
        }}
      >
        {changed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${url}?v=${encodeURIComponent(changed)}`}
            alt={title}
            style={{ maxHeight: 100, maxWidth: "90%", objectFit: "contain" }}
          />
        ) : (
          <Typography.Text type="secondary">No {title.toLowerCase()} yet</Typography.Text>
        )}
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        {hint}
      </Typography.Paragraph>
      {canEdit && (
        <Space>
          <Upload
            accept="image/png,image/jpeg"
            showUploadList={false}
            beforeUpload={(file) => {
              void upload(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={busy}>
              {changed ? "Replace" : "Upload"}
            </Button>
          </Upload>
          {changed && (
            <Button icon={<DeleteOutlined />} danger onClick={remove} disabled={busy}>
              Remove
            </Button>
          )}
        </Space>
      )}
    </Card>
  );
}
