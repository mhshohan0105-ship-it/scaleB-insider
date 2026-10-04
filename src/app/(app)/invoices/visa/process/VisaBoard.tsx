"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Card, Col, Empty, Input, Row, Space, Tag, Typography } from "antd";
import { formatDate } from "@/lib/format";
import type { VisaBoardCard } from "@/server/services/invoices/visaInvoiceService";
import { PageHeader } from "@/components/PageHeader";
import { useUrlParams } from "@/components/useUrlParams";
import { VisaStatusButtons } from "@/components/invoices/VisaInvoiceView";
import {
  VISA_STATUS_COLOR,
  VISA_STATUS_LABEL,
  VISA_STATUS_ORDER,
} from "@/components/invoices/visaStatus";

const daysSince = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);

export function VisaBoard({
  cards,
  q,
  canMove,
}: {
  cards: VisaBoardCard[];
  q: string;
  canMove: boolean;
}) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(q);

  return (
    <>
      <PageHeader
        title="Visa Process"
        description="Every visa on a posted invoice, by status. Delivered visas stay here for 30 days."
        extra={
          <Input.Search
            allowClear
            placeholder="Passenger, passport, country, client or invoice"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 340 }}
          />
        }
      />
      <Row gutter={12} wrap={false} style={{ overflowX: "auto", paddingBottom: 8 }}>
        {VISA_STATUS_ORDER.map((status) => {
          const list = cards.filter((c) => c.status === status);
          return (
            <Col key={status} flex="0 0 280px">
              <Card
                size="small"
                title={
                  <Space>
                    <Tag color={VISA_STATUS_COLOR[status]}>{VISA_STATUS_LABEL[status]}</Tag>
                    <Badge count={list.length} showZero color="#94a3b8" />
                  </Space>
                }
                styles={{ body: { background: "#f7f9f9", minHeight: 200, padding: 8 } }}
              >
                {list.length === 0 && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="None" />
                )}
                {list.map((c) => {
                  const age = daysSince(c.statusChangedAt);
                  const late =
                    c.expectedDate &&
                    status !== "DELIVERED" &&
                    c.expectedDate < new Date().toISOString().slice(0, 10);
                  return (
                    <Card
                      key={c.id}
                      size="small"
                      style={{ marginBottom: 8 }}
                      data-testid="visa-card"
                    >
                      <Typography.Text strong>{c.passengerName}</Typography.Text>
                      {c.passportNo && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {" "}
                          {c.passportNo}
                        </Typography.Text>
                      )}
                      <div>
                        {c.country}
                        {c.visaType && ` · ${c.visaType}`}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        <Link href={`/invoices/visa/${c.invoiceId}`}>{c.invoiceNumber}</Link> ·{" "}
                        {c.clientName}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Vendor: {c.vendor}</div>
                      <Space size={4} wrap style={{ marginTop: 6 }}>
                        <Tag color={age > 7 && status !== "DELIVERED" ? "orange" : undefined}>
                          {age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"}`}
                        </Tag>
                        {c.expectedDate && status !== "DELIVERED" && (
                          <Tag color={late ? "red" : undefined}>
                            expected {formatDate(c.expectedDate)}
                          </Tag>
                        )}
                        {c.deliveryDate && (
                          <Tag color="green">delivered {formatDate(c.deliveryDate)}</Tag>
                        )}
                      </Space>
                      {canMove && (
                        <div style={{ marginTop: 8 }}>
                          <VisaStatusButtons lineId={c.id} status={c.status} />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </Card>
            </Col>
          );
        })}
      </Row>
    </>
  );
}
