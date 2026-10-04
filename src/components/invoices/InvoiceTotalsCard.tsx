"use client";

import { Card, Col, Descriptions, Form, Input, Row, Typography } from "antd";
import type { InvoiceTotals } from "@/lib/calc/invoiceTotals";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/MoneyInput";

/** Discount / service charge / VAT / note inputs with the live totals. */
export function InvoiceTotalsCard({ totals }: { totals: InvoiceTotals | null }) {
  const money = (v: { toFixed(n: number): string } | null | undefined) =>
    v ? formatMoney(v.toFixed(2)) : "-";
  return (
    <Card title="Totals" style={{ marginBottom: 16 }}>
      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Discount" name="discount">
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Service charge" name="serviceCharge">
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="VAT" name="vat">
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Note" name="note">
                <Input.TextArea rows={2} maxLength={1000} />
              </Form.Item>
            </Col>
          </Row>
        </Col>
        <Col xs={24} lg={12}>
          <Descriptions
            bordered
            size="small"
            column={1}
            items={[
              { key: "sub", label: "Lines (client price)", children: money(totals?.subtotal) },
              {
                key: "net",
                label: "Client pays",
                children: <strong>{money(totals?.netTotal)}</strong>,
              },
              { key: "cost", label: "Payable to vendors", children: money(totals?.totalCost) },
              {
                key: "profit",
                label: "Profit",
                children: (
                  <Typography.Text strong type={totals?.profit.isNegative() ? "danger" : "success"}>
                    {money(totals?.profit)}
                  </Typography.Text>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </Card>
  );
}
