"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Col, Form, Input, Row, Select, Switch, Typography } from "antd";
import { DOCUMENT_TYPES } from "@/lib/documentPrefixes";
import { COMMISSION_BASE_OPTIONS } from "@/lib/masters";
import type { AppConfig } from "@/server/services/settings/settingsService";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { saveAppConfigAction } from "../actions";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, i) => ({ value: i + 1, label }));

export function AppConfigForm({ initial, canEdit }: { initial: AppConfig; canEdit: boolean }) {
  const [form] = Form.useForm<AppConfig>();
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onFinish(values: AppConfig) {
    startTransition(async () => {
      const result = await saveAppConfigAction(values);
      if (applyActionResult(result, form, message, "Settings saved")) router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="App Config"
        description="Defaults used across invoices, accounts and messaging."
      />
      <Form<AppConfig>
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card title="General" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Currency" name="currency" rules={[{ required: true }]}>
                    <Input maxLength={3} style={{ textTransform: "uppercase" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Fiscal year starts in" name="fiscalYearStart">
                    <Select options={MONTHS} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                label="SMS notifications"
                name="smsEnabled"
                valuePropName="checked"
                extra="Sends receipts and due reminders once an SMS gateway is connected."
              >
                <Switch />
              </Form.Item>
            </Card>

            <Card title="Air ticket calculation" style={{ marginBottom: 16 }}>
              <Typography.Paragraph type="secondary">
                AIT (advance income tax) and commission defaults. Airlines can override the
                commission settings individually. Confirm the current AIT rule with your accountant.
              </Typography.Paragraph>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="AIT rate" name="aitRatePercent" rules={[{ required: true }]}>
                    <MoneyInput precision={4} max="100" suffix="%" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="AIT calculated on" name="aitBase">
                    <Select options={[...COMMISSION_BASE_OPTIONS]} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="Commission calculated on" name="commissionBase">
                <Select options={[...COMMISSION_BASE_OPTIONS]} />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Document number prefixes" style={{ marginBottom: 16 }}>
              <Row gutter={12}>
                {DOCUMENT_TYPES.map((d) => (
                  <Col span={12} key={d.key}>
                    <Form.Item
                      label={d.label}
                      name={["invoicePrefixes", d.key]}
                      rules={[
                        {
                          required: true,
                          pattern: /^[A-Za-z0-9]{1,6}$/,
                          message: "1 to 6 letters or digits",
                        },
                      ]}
                    >
                      <Input maxLength={6} style={{ textTransform: "uppercase" }} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>

        <Card title="Invoice text" style={{ marginBottom: 16 }}>
          <Form.Item label="Footer (printed at the bottom of every invoice)" name="invoiceFooter">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="Terms and conditions" name="invoiceTerms">
            <Input.TextArea rows={5} maxLength={2000} showCount />
          </Form.Item>
        </Card>

        {canEdit && (
          <Button type="primary" htmlType="submit" loading={pending}>
            Save settings
          </Button>
        )}
      </Form>
    </>
  );
}
