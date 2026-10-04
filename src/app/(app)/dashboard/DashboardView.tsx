"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Card,
  Col,
  Empty,
  List,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import type { Dashboard, RankRow } from "@/server/services/dashboard/dashboardService";

const COLORS = ["#0e7c6b", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b"];
const KIND: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank",
  MOBILE_BANKING: "Mobile banking",
  CREDIT_CARD: "Card",
};

// Charts need plain numbers; the figures themselves stay exact strings everywhere else.
const num = (v: string) => Number(v);
const short = (v: number) =>
  Math.abs(v) >= 1e7
    ? `${(v / 1e7).toFixed(1)}Cr`
    : Math.abs(v) >= 1e5
      ? `${(v / 1e5).toFixed(1)}L`
      : `${Math.round(v / 1000)}k`;
const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });

function PeriodCard({
  title,
  figures,
  tone,
}: {
  title: string;
  figures: Dashboard["sales"];
  tone?: string;
}) {
  return (
    <Card size="small" style={{ height: "100%" }}>
      <Typography.Text type="secondary">{title}</Typography.Text>
      <Row gutter={8} style={{ marginTop: 8 }}>
        {(["today", "month", "year"] as const).map((k) => (
          <Col span={8} key={k}>
            <Statistic
              title={k === "today" ? "Today" : k === "month" ? "This month" : "This year"}
              value={formatMoney(figures[k])}
              valueStyle={{ fontSize: k === "today" ? 20 : 15, color: tone }}
            />
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function Ranking({
  rows,
  empty,
  href,
}: {
  rows: RankRow[];
  empty: string;
  href?: (id: string) => string;
}) {
  if (rows.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
  const max = Math.max(...rows.map((r) => num(r.amount)), 1);
  return (
    <List
      size="small"
      dataSource={rows}
      renderItem={(r, i) => (
        <List.Item extra={<strong>{formatMoney(r.amount)}</strong>}>
          <div style={{ width: "100%" }}>
            <Space>
              <Tag>{i + 1}</Tag>
              {href ? <Link href={href(r.id)}>{r.name}</Link> : r.name}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {r.count} invoice{r.count === 1 ? "" : "s"}
              </Typography.Text>
            </Space>
            <div style={{ height: 4, background: "#eef2f2", borderRadius: 2, marginTop: 6 }}>
              <div
                style={{
                  width: `${(num(r.amount) / max) * 100}%`,
                  height: 4,
                  background: "#0e7c6b",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}

export function DashboardView({
  data,
  userName,
  canSeeAccounts,
  canSeeReports,
}: {
  data: Dashboard;
  userName: string;
  canSeeAccounts: boolean;
  canSeeReports: boolean;
}) {
  const [rankPeriod, setRankPeriod] = useState<"month" | "year">("month");
  const chart = data.chart.map((c) => ({
    month: monthLabel(c.month),
    Sales: num(c.sales),
    Purchase: num(c.purchase),
    Collection: num(c.collection),
    Profit: num(c.profit),
  }));
  const expenseData = data.expenses.map((e) => ({ name: e.name, value: num(e.amount) }));

  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Welcome back, {userName}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
        {formatDate(data.today)} · fiscal year {data.fiscalYearLabel}
      </Typography.Paragraph>

      {data.ledgerHealthy === false && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="The ledger check found a mismatch between cached balances and the journal. Please contact support."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <PeriodCard title="Sales" figures={data.sales} />
        </Col>
        <Col xs={24} xl={8}>
          <PeriodCard title="Collection" figures={data.collection} tone="#0e7c6b" />
        </Col>
        <Col xs={24} xl={8}>
          <PeriodCard title="Discount given" figures={data.discount} />
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic
              title={
                canSeeReports ? (
                  <Link href="/reports/due?party=clients&show=due">Total receivable</Link>
                ) : (
                  "Total receivable"
                )
              }
              value={formatMoney(data.receivable)}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic
              title={
                canSeeReports ? (
                  <Link href="/reports/due?party=vendors&show=advance">Total payable</Link>
                ) : (
                  "Total payable"
                )
              }
              value={formatMoney(data.payable)}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic
              title={
                canSeeReports ? (
                  <Link href="/reports/due?party=clients&show=advance">Client advances held</Link>
                ) : (
                  "Client advances held"
                )
              }
              value={formatMoney(data.clientAdvance)}
            />
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card title={`This fiscal year by month`} size="small">
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={short} width={48} />
                  <Tooltip formatter={(v) => formatMoney(Number(v).toFixed(2))} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#0e7c6b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Purchase" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Collection" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Line dataKey="Profit" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Expenses this year" size="small" style={{ height: "100%" }}>
            {expenseData.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No expenses yet" />
            ) : (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {expenseData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(Number(v).toFixed(2))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card title="Flights in the next 7 days" size="small">
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data.flights}
              locale={{ emptyText: "No departures this week" }}
              scroll={{ x: "max-content" }}
              columns={[
                { title: "Date", dataIndex: "journeyDate", render: (v: string) => formatDate(v) },
                {
                  title: "Passenger",
                  dataIndex: "passengerName",
                  render: (v: string, r) => (
                    <Link href={invoiceHref(r.invoiceType, r.invoiceId) ?? "#"}>{v}</Link>
                  ),
                },
                { title: "Route", dataIndex: "route" },
                { title: "Airline", dataIndex: "airline" },
                { title: "PNR", dataIndex: "pnr", render: (v: string | null) => v ?? "-" },
                { title: "Client", dataIndex: "clientName" },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card
            title="Account balances"
            size="small"
            extra={canSeeAccounts && <Link href="/accounts/balancestatus">Details</Link>}
          >
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data.accounts}
              columns={[
                { title: "Account", dataIndex: "name" },
                { title: "Type", dataIndex: "kind", render: (k: string) => KIND[k] ?? k },
                {
                  title: "Balance",
                  dataIndex: "balance",
                  align: "right",
                  render: (v: string) => formatMoney(v),
                },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <strong>Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <strong>{formatMoney(data.accountsTotal)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title="Best clients"
            size="small"
            extra={
              <Segmented
                size="small"
                value={rankPeriod}
                onChange={(v) => setRankPeriod(v as "month" | "year")}
                options={[
                  { value: "month", label: "Month" },
                  { value: "year", label: "Year" },
                ]}
              />
            }
          >
            <Ranking
              rows={data.bestClients[rankPeriod]}
              empty="No sales yet"
              href={(id) => `/clients/${id}`}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={`Best salespeople (${rankPeriod === "month" ? "this month" : "this year"})`}
            size="small"
          >
            <Ranking
              rows={data.bestSalesmen[rankPeriod]}
              empty="No invoices with a salesperson yet"
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            size="small"
            title="Passports expiring"
            extra={<Link href="/passports?expiry=SOON">All</Link>}
            style={{ height: "100%" }}
          >
            <Space size="large" style={{ marginBottom: 8 }}>
              <Link href="/passports?expiry=EXPIRED">
                <Statistic
                  title="Expired"
                  value={data.alerts.passports.expired}
                  valueStyle={{ color: "#cf1322" }}
                />
              </Link>
              <Link href="/passports?expiry=SOON">
                <Statistic
                  title="Within 6 months"
                  value={data.alerts.passports.soon}
                  valueStyle={{ color: "#d46b08" }}
                />
              </Link>
            </Space>
            {data.alerts.passports.list.length === 0 ? (
              <Typography.Text type="secondary">No passports expiring soon.</Typography.Text>
            ) : (
              data.alerts.passports.list.map((p) => (
                <div
                  key={p.id}
                  style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
                >
                  <Link href={`/passports/${p.id}`}>
                    {p.name} · {p.passportNo}
                  </Link>
                  <Tag color={p.expiry === "EXPIRED" ? "red" : "orange"}>
                    {formatDate(p.expiryDate)}
                  </Tag>
                </div>
              ))
            )}
          </Card>
        </Col>
        <Col xs={24} md={12} lg={7}>
          <Card
            size="small"
            title="Visas in process"
            extra={<Link href="/invoices/visa/process">Board</Link>}
            style={{ height: "100%" }}
          >
            {data.alerts.visas.length === 0 ? (
              <Typography.Text type="secondary">No visas in process.</Typography.Text>
            ) : (
              <Space size="large" wrap>
                {data.alerts.visas.map((v) => (
                  <Statistic
                    key={v.status}
                    title={v.status.charAt(0) + v.status.slice(1).toLowerCase()}
                    value={v.count}
                  />
                ))}
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12} lg={7}>
          <Card
            size="small"
            title="Cheques not cleared"
            extra={<Link href="/cheques?chequeStatus=PENDING">Cheques</Link>}
            style={{ height: "100%" }}
          >
            {data.alerts.cheques.length === 0 ? (
              <Typography.Text type="secondary">No cheques waiting.</Typography.Text>
            ) : (
              <Space size="large" wrap>
                {data.alerts.cheques.map((c) => (
                  <Statistic
                    key={c.direction}
                    title={`${c.direction === "RECEIVED" ? "Received" : "Issued"} (${c.count})`}
                    value={formatMoney(c.amount)}
                  />
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
