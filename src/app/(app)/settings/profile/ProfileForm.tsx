"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Col, Form, Input, Row, Tag } from "antd";
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
            <Col xs={24}>
              <Form.Item
                label="Logo URL"
                name="logoUrl"
                extra="Direct logo upload arrives once file storage is configured. For now, paste a link to the image."
              >
                <Input maxLength={500} placeholder="https://" />
              </Form.Item>
            </Col>
          </Row>
          {canEdit && (
            <Button type="primary" htmlType="submit" loading={pending}>
              Save profile
            </Button>
          )}
        </Form>
      </Card>
    </>
  );
}
