"use client";

import Link from "next/link";
import { Alert, Card, Col, Descriptions, Flex, Row, Space, Table, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import { REFUND_METHOD_LABEL, REFUND_TYPE_INFO, type RefundTypeKey } from "@/lib/refundTypes";
import type { RefundView as Refund } from "@/server/services/refund/postRefund";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { voidRefundAction } from "@/app/(app)/refunds/actions";

type Line = Refund["lines"][number];

export function RefundView({ refund, canVoid }: { refund: Refund; canVoid: boolean }) {
  const info = REFUND_TYPE_INFO[refund.type as RefundTypeKey];
  const money = (v: string) => formatMoney(v);
  return (
    <>
      <Link href={info.path} style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> {info.label} refunds
      </Link>
      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="flex-start" wrap gap={16}>
          <Space direction="vertical" size={2}>
            <Space>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {refund.number}
              </Typography.Title>
              <DocumentStatusTag status={refund.status} />
            </Space>
            <Typography.Text>
              <Link href={`/clients/${refund.client.id}`}>{refund.client.name}</Link>{" "}
              <Typography.Text type="secondary">({refund.client.code})</Typography.Text>
            </Typography.Text>
            <Typography.Text type="secondary">
              {formatDate(refund.date)} · invoice{" "}
              <Link href={invoiceHref(refund.invoice.type, refund.invoice.id) ?? "#"}>
                {refund.invoice.number}
              </Link>{" "}
              of {formatDate(refund.invoice.date)}
            </Typography.Text>
          </Space>
          {canVoid && refund.status === "POSTED" && (
            <VoidButton
              what={`refund ${refund.number}`}
              description="The sale and cost come back onto the invoice; money paid back returns to the account."
              onVoid={(v) => voidRefundAction(refund.id, v)}
            />
          )}
        </Flex>
        {refund.status === "VOID" && (
          <Alert
            style={{ marginTop: 16 }}
            type="error"
            showIcon
            message={`Void: ${refund.voidReason ?? ""}`}
          />
        )}
      </Card>

      <Card title={`Refunded lines (${refund.lines.length})`} style={{ marginBottom: 16 }}>
        <Table<Line>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={refund.lines}
          scroll={{ x: "max-content" }}
          columns={[
            { title: "Line", dataIndex: "description", key: "d" },
            {
              title: "Vendor",
              key: "v",
              render: (_, l) =>
                l.vendor ? <Link href={`/vendors/${l.vendor.id}`}>{l.vendor.name}</Link> : "-",
            },
            {
              title: "Refund to client",
              dataIndex: "clientAmount",
              key: "c",
              align: "right",
              render: money,
            },
            {
              title: "Back from vendor",
              dataIndex: "vendorAmount",
              key: "va",
              align: "right",
              render: money,
            },
            {
              title: "Vendor keeps",
              dataIndex: "vendorCharge",
              key: "vc",
              align: "right",
              render: money,
            },
          ]}
        />
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="Client" style={{ marginBottom: 16 }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: "r",
                  label: "Sales taken back",
                  children: money(refund.clientRefundAmount),
                },
                { key: "c", label: "Refund charge", children: `- ${money(refund.clientCharge)}` },
                {
                  key: "cc",
                  label: "Credit to client",
                  children: <strong>{money(refund.clientCredit)}</strong>,
                },
                {
                  key: "m",
                  label: "Method",
                  children:
                    refund.method === "CASH_RETURN"
                      ? `${REFUND_METHOD_LABEL.CASH_RETURN}: ${money(refund.returnAmount)} from ${refund.moneyAccount ?? ""}`
                      : REFUND_METHOD_LABEL.ADJUST_TO_BALANCE,
                },
              ]}
            />
            {refund.note && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                Note: {refund.note}
              </Typography.Paragraph>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Vendors and profit" style={{ marginBottom: 16 }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: "v",
                  label: "Cost taken back",
                  children: money(refund.vendorRefundAmount),
                },
                { key: "vc", label: "Vendor charges", children: `- ${money(refund.vendorCharge)}` },
                {
                  key: "vcr",
                  label: "Back from vendors",
                  children: <strong>{money(refund.vendorCredit)}</strong>,
                },
                {
                  key: "p",
                  label: "Effect on profit",
                  children: (
                    <Typography.Text
                      type={refund.profitEffect.startsWith("-") ? "danger" : "success"}
                    >
                      {money(refund.profitEffect)}
                    </Typography.Text>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
