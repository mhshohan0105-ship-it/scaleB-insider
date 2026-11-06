"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  List,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Area,
  AreaChart,
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
import { trend } from "@/lib/calc/trend";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import type { Dashboard, RankRow } from "@/server/services/dashboard/dashboardService";
import { THEME } from "@/components/Providers";
import { StatusTag } from "@/components/StatusTag";

const COLORS = [THEME.brand, "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b"];
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
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** "▲ 12% vs yesterday" under a figure. */
function TrendNote({ now, before, label }: { now: string; before: string; label: string }) {
  const t = trend(now, before);
  if (t.direction === "flat" && t.percent === null)
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Nothing {label}
      </Typography.Text>
    );
  const up = t.direction === "up";
  const color = t.direction === "flat" ? THEME.muted : up ? THEME.success : THEME.danger;
  return (
    <span style={{ fontSize: 12, color }}>
      {t.direction !== "flat" && (up ? <ArrowUpOutlined /> : <ArrowDownOutlined />)}{" "}
      {t.percent !== null ? `${t.percent}% ` : ""}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t.percent !== null ? `vs ${label}` : `Was ${formatMoney(before)} ${label}`}
      </Typography.Text>
    </span>
  );
}

function KpiCard({
  title,
  value,
  note,
  color,
}: {
  title: ReactNode;
  value: string;
  note?: ReactNode;
  color?: string;
}) {
  return (
    <Card size="small" style={{ height: "100%" }} styles={{ body: { padding: "14px 16px" } }}>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {title}
      </Typography.Text>
      <div
        style={{
          fontSize: "clamp(17px, 4.6vw, 24px)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color,
          margin: "4px 0 2px",
        }}
      >
        {value}
      </div>
      {note}
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
            <div style={{ height: 4, background: "#eef2f1", borderRadius: 2, marginTop: 6 }}>
              <div
                style={{
                  width: `${(num(r.amount) / max) * 100}%`,
                  height: 4,
                  background: THEME.brand,
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
  actions,
  canSeeAccounts,
  canSeeClients,
  canSeeExpenses,
  canSeeReports,
  canReceive,
}: {
  data: Dashboard;
  userName: string;
  actions: { label: string; href: string }[];
  canSeeAccounts: boolean;
  canSeeClients: boolean;
  canSeeExpenses: boolean;
  canSeeReports: boolean;
  canReceive: boolean;
}) {
  const [rankPeriod, setRankPeriod] = useState<"month" | "year">("month");
  const chart = data.chart.map((c) => ({
    month: monthLabel(c.month),
    Sales: num(c.sales),
    Purchase: num(c.purchase),
    Collection: num(c.collection),
    Profit: num(c.profit),
  }));
  const daily = data.daily.map((c) => ({
    day: dayLabel(c.date),
    Sales: num(c.sales),
    Collection: num(c.collection),
  }));
  const expenseData = data.expenses.map((e) => ({ name: e.name, value: num(e.amount) }));
  const reportLink = (href: string, text: string) =>
    canSeeReports ? <Link href={href}>{text}</Link> : text;

  return (
    <>
      <Flex justify="space-between" align="flex-start" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Welcome back, {userName}
          </Typography.Title>
          <Typography.Text type="secondary">
            {formatDate(data.today)} · fiscal year {data.fiscalYearLabel}
          </Typography.Text>
        </div>
        <Flex gap={8} wrap>
          {actions.map((a) => (
            <Link key={a.href} href={a.href}>
              <Button icon={<PlusOutlined />}>{a.label}</Button>
            </Link>
          ))}
        </Flex>
      </Flex>

      {data.ledgerHealthy === false && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="The ledger check found a mismatch between cached balances and the journal. Please contact support."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} xl={6}>
          <KpiCard
            title="Sales today"
            value={formatMoney(data.sales.today)}
            note={
              <TrendNote
                now={data.sales.today}
                before={data.previous.salesYesterday}
                label="yesterday"
              />
            }
          />
        </Col>
        <Col xs={12} xl={6}>
          <KpiCard
            title="Collected today"
            value={formatMoney(data.collection.today)}
            color={THEME.success}
            note={
              <TrendNote
                now={data.collection.today}
                before={data.previous.collectionYesterday}
                label="yesterday"
              />
            }
          />
        </Col>
        <Col xs={12} xl={6}>
          <KpiCard
            title={reportLink("/reports/due?party=clients&show=due", "Total receivable")}
            value={formatMoney(data.receivable)}
            color={THEME.danger}
            note={
              data.overdue.count > 0 ? (
                <Typography.Text type="danger" style={{ fontSize: 12 }}>
                  {formatMoney(data.overdue.amount)} past due date
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Nothing past its due date
                </Typography.Text>
              )
            }
          />
        </Col>
        <Col xs={12} xl={6}>
          {canSeeAccounts ? (
            <KpiCard
              title="Cash and bank"
              value={formatMoney(data.accountsTotal)}
              note={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {data.accounts.length} account{data.accounts.length === 1 ? "" : "s"}
                </Typography.Text>
              }
            />
          ) : (
            <KpiCard
              title={reportLink("/reports/due?party=vendors&show=advance", "Total payable")}
              value={formatMoney(data.payable)}
            />
          )}
        </Col>

        <Col xs={24} xl={16}>
          <Card title="Last 30 days" size="small" style={{ height: "100%" }}>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" minTickGap={28} tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={short} width={48} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatMoney(Number(v).toFixed(2))} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Sales"
                    stroke={THEME.brand}
                    fill={THEME.brand}
                    fillOpacity={0.14}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Collection"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="At a glance" size="small" style={{ height: "100%" }}>
            <Table
              size="small"
              pagination={false}
              rowKey="key"
              dataSource={[
                { key: "Sales", f: data.sales },
                { key: "Collection", f: data.collection },
                { key: "Discount", f: data.discount },
              ]}
              columns={[
                { title: "", dataIndex: "key" },
                {
                  title: "This month",
                  key: "m",
                  align: "right",
                  render: (_, r) => formatMoney(r.f.month),
                },
                {
                  title: "This year",
                  key: "y",
                  align: "right",
                  render: (_, r) => formatMoney(r.f.year),
                },
              ]}
            />
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Sales vs last month</Typography.Text>
                <TrendNote
                  now={data.sales.month}
                  before={data.previous.salesLastMonth}
                  label="same days"
                />
              </Flex>
              <Flex justify="space-between">
                <span>
                  {reportLink("/reports/due?party=vendors&show=advance", "Total payable")}
                </span>
                <strong>{formatMoney(data.payable)}</strong>
              </Flex>
              <Flex justify="space-between">
                <span>
                  {reportLink("/reports/due?party=clients&show=advance", "Client advances held")}
                </span>
                <strong>{formatMoney(data.clientAdvance)}</strong>
              </Flex>
            </div>
          </Card>
        </Col>

        {canSeeClients && (
          <Col xs={24} xl={12}>
            <Card
              title="Who owes the most"
              size="small"
              style={{ height: "100%" }}
              extra={canSeeReports && <Link href="/reports/due?party=clients&show=due">All</Link>}
            >
              {data.topDues.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No client owes anything" />
              ) : (
                <List
                  size="small"
                  dataSource={data.topDues}
                  renderItem={(c) => (
                    <List.Item
                      extra={
                        <Space>
                          <Typography.Text type="danger" strong>
                            {formatMoney(c.balance)}
                          </Typography.Text>
                          {canReceive && (
                            <Link href={`/moneyreceipts/new?client=${c.id}`}>
                              <Button size="small" type="primary" ghost>
                                Receive
                              </Button>
                            </Link>
                          )}
                        </Space>
                      }
                    >
                      <div>
                        <Link href={`/clients/${c.id}`}>{c.name}</Link>
                        <div style={{ fontSize: 12, color: THEME.muted }}>
                          {[c.code, c.phone].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        )}
        <Col xs={24} xl={canSeeClients ? 12 : 24}>
          <Card
            title={
              data.overdue.count > 0 ? `Past due date (${data.overdue.count})` : "Past due date"
            }
            size="small"
            style={{ height: "100%" }}
          >
            {data.overdue.list.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing is overdue" />
            ) : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={data.overdue.list}
                scroll={{ x: "max-content" }}
                columns={[
                  {
                    title: "Invoice",
                    dataIndex: "number",
                    render: (v: string, r) => (
                      <Link href={invoiceHref(r.type, r.id) ?? "#"}>{v}</Link>
                    ),
                  },
                  { title: "Client", dataIndex: "clientName" },
                  {
                    title: "Was due",
                    dataIndex: "dueDate",
                    render: (v: string) => formatDate(v),
                  },
                  {
                    title: "Due",
                    dataIndex: "due",
                    align: "right",
                    render: (v: string) => (
                      <Typography.Text type="danger">{formatMoney(v)}</Typography.Text>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card title="Flights in the next 7 days" size="small" style={{ height: "100%" }}>
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
          <Card title="Recent invoices" size="small" style={{ height: "100%" }}>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data.recent}
              locale={{ emptyText: "No invoices yet" }}
              scroll={{ x: "max-content" }}
              columns={[
                {
                  title: "Invoice",
                  dataIndex: "number",
                  render: (v: string, r) => (
                    <>
                      <Link href={invoiceHref(r.type, r.id) ?? "#"}>{v}</Link>
                      <div style={{ fontSize: 12, color: THEME.muted }}>{r.clientName}</div>
                    </>
                  ),
                },
                {
                  title: "Total",
                  dataIndex: "netTotal",
                  align: "right",
                  render: (v: string) => formatMoney(v),
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  render: (s: string) => <StatusTag status={s} />,
                },
              ]}
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
                  valueStyle={{ color: THEME.danger }}
                />
              </Link>
              <Link href="/passports?expiry=SOON">
                <Statistic
                  title="Within 6 months"
                  value={data.alerts.passports.soon}
                  valueStyle={{ color: THEME.warning }}
                />
              </Link>
            </Space>
            {data.alerts.passports.list.length === 0 ? (
              <Typography.Text type="secondary" style={{ display: "block" }}>
                No passports expiring soon.
              </Typography.Text>
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

        <Col xs={24} xl={canSeeExpenses ? 16 : 24}>
          <Card title="This fiscal year by month" size="small" style={{ height: "100%" }}>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={short} width={48} />
                  <Tooltip formatter={(v) => formatMoney(Number(v).toFixed(2))} />
                  <Legend />
                  <Bar dataKey="Sales" fill={THEME.brand} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Purchase" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Collection" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Line dataKey="Profit" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        {canSeeExpenses && (
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
        )}

        {canSeeAccounts && (
          <Col xs={24} xl={8}>
            <Card
              title="Account balances"
              size="small"
              style={{ height: "100%" }}
              extra={<Link href="/accounts/balancestatus">Details</Link>}
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
        )}
        <Col xs={24} md={12} xl={canSeeAccounts ? 8 : 12}>
          <Card
            title="Best clients"
            size="small"
            style={{ height: "100%" }}
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
              href={canSeeClients ? (id) => `/clients/${id}` : undefined}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={canSeeAccounts ? 8 : 12}>
          <Card
            title={`Best salespeople (${rankPeriod === "month" ? "this month" : "this year"})`}
            size="small"
            style={{ height: "100%" }}
          >
            <Ranking
              rows={data.bestSalesmen[rankPeriod]}
              empty="No invoices with a salesperson yet"
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
