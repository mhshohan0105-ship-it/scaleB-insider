"use client";

import Link from "next/link";
import { Card, Col, Empty, List, Row, Statistic, Typography } from "antd";
import { formatMoney } from "@/lib/format";
import { MONEY_ACCOUNT_KIND_OPTIONS } from "@/lib/schemas/accounts";
import type { BalanceStatus } from "@/server/services/accounts/moneyAccountService";
import { PageHeader } from "@/components/PageHeader";

const KIND_LABEL = Object.fromEntries(MONEY_ACCOUNT_KIND_OPTIONS.map((o) => [o.value, o.label]));

export function BalanceStatusView({ status }: { status: BalanceStatus }) {
  return (
    <>
      <PageHeader
        title="Balance Status"
        description="What you hold right now, account by account."
      />
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[24, 16]}>
          <Col xs={24} md={8}>
            <Statistic title="Total available" value={formatMoney(status.total)} prefix="BDT" />
          </Col>
          {status.groups.map((g) => (
            <Col xs={12} md={4} key={g.kind}>
              <Statistic title={KIND_LABEL[g.kind]} value={formatMoney(g.total)} />
            </Col>
          ))}
        </Row>
      </Card>
      {status.groups.length === 0 ? (
        <Card>
          <Empty description="No active accounts yet" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {status.groups.map((g) => (
            <Col xs={24} md={12} key={g.kind}>
              <Card title={KIND_LABEL[g.kind]} extra={<strong>{formatMoney(g.total)}</strong>}>
                <List
                  dataSource={g.accounts}
                  renderItem={(a) => (
                    <List.Item
                      extra={
                        <Typography.Text
                          strong
                          type={a.balance.startsWith("-") ? "danger" : undefined}
                        >
                          {formatMoney(a.balance)}
                        </Typography.Text>
                      }
                    >
                      <List.Item.Meta
                        title={
                          <Link href={`/accounts/transactions?account=${a.id}`}>{a.name}</Link>
                        }
                        description={
                          [a.bankName, a.accountNoMasked].filter(Boolean).join(" · ") || null
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
