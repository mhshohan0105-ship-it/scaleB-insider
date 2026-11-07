"use client";

import { Card, Col, Descriptions, Row, Tag, Typography } from "antd";
import { formatDate } from "@/lib/format";
import { NAV } from "@/lib/nav";
import { PLAN_MODULES } from "@/lib/subscription";
import type { SubscriptionPageData } from "@/server/services/subscription/subscriptionService";
import { PageHeader } from "@/components/PageHeader";

const MODULE_LABEL = Object.fromEntries(NAV.map((m) => [m.module, m.label]));

function stageTag(d: SubscriptionPageData) {
  const s = d.status;
  if (s.state === "expired") return <Tag color="red">Ended · view only</Tag>;
  if (s.state === "grace") return <Tag color="orange">Payment due</Tag>;
  if (s.trial) return <Tag color="blue">Free trial</Tag>;
  return <Tag color="green">Active</Tag>;
}

/** The agency's own view of its plan: what it includes, until when, and the other plans. */
export function SubscriptionView({ data }: { data: SubscriptionPageData }) {
  const { plan, contact } = data;
  const included = plan.modules.length ? plan.modules : PLAN_MODULES;
  const period = data.status.trial
    ? data.trialEndsOn && `Trial ends ${formatDate(data.trialEndsOn)}`
    : data.paidUntilOn
      ? `Paid until ${formatDate(data.paidUntilOn)}`
      : "No end date";

  return (
    <>
      <PageHeader
        title="Subscription"
        description="Your plan, what it includes and how long it runs."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Your plan">
            <Descriptions column={1} size="small" labelStyle={{ width: 150 }}>
              <Descriptions.Item label="Plan">
                <Typography.Text strong>{plan.name}</Typography.Text> {stageTag(data)}
              </Descriptions.Item>
              <Descriptions.Item label="Period">{period}</Descriptions.Item>
              {data.priceLine && (
                <Descriptions.Item label="Price">{data.priceLine}</Descriptions.Item>
              )}
              <Descriptions.Item label="Users">
                {data.activeUsers} active
                {plan.maxUsers ? ` of ${plan.maxUsers} allowed` : " (no limit)"}
              </Descriptions.Item>
              <Descriptions.Item label="Includes">
                {plan.modules.length ? (
                  <span>
                    {included.map((m) => (
                      <Tag key={m} style={{ marginBottom: 4 }}>
                        {MODULE_LABEL[m] ?? m}
                      </Tag>
                    ))}
                  </span>
                ) : (
                  "Every module"
                )}
              </Descriptions.Item>
            </Descriptions>
            {data.status.state === "expired" && (
              <Typography.Paragraph type="danger" style={{ marginTop: 12, marginBottom: 0 }}>
                Nothing has been deleted. Viewing, printing and exporting still work; adding or
                changing records starts again as soon as the subscription is renewed.
              </Typography.Paragraph>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Renew or change plan">
            <Typography.Paragraph>
              To renew, upgrade or ask about a plan, contact
              {contact ? ` ${contact.name}` : " us"}. Your plan is changed as soon as the payment is
              received.
            </Typography.Paragraph>
            {contact && (contact.phone || contact.email) && (
              <Descriptions column={1} size="small">
                {contact.phone && (
                  <Descriptions.Item label="Phone">
                    <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                  </Descriptions.Item>
                )}
                {contact.email && (
                  <Descriptions.Item label="Email">
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Card>
        </Col>
        {data.plans.length > 1 && (
          <Col span={24}>
            <Card title="Plans">
              <Row gutter={[12, 12]}>
                {data.plans.map((p) => (
                  <Col key={p.code} xs={24} md={12} xl={8}>
                    <Card
                      size="small"
                      style={{
                        height: "100%",
                        borderColor: p.code === plan.code ? "#0f766e" : undefined,
                      }}
                      title={
                        <span>
                          {p.name} {p.code === plan.code && <Tag color="green">yours</Tag>}
                        </span>
                      }
                    >
                      <Typography.Paragraph style={{ marginBottom: 4 }}>
                        {p.priceLine || "Price on request"}
                      </Typography.Paragraph>
                      <Typography.Text type="secondary">
                        {p.maxUsers ? `Up to ${p.maxUsers} users` : "Unlimited users"} ·{" "}
                        {p.modules.length
                          ? `${p.modules.length} of ${PLAN_MODULES.length} modules`
                          : "every module"}
                      </Typography.Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}
      </Row>
    </>
  );
}
