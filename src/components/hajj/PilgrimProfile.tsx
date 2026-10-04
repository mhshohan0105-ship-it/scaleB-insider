"use client";

import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Row,
  Space,
  Table,
  Timeline,
  Typography,
} from "antd";
import { ArrowLeftOutlined, EditOutlined, StopOutlined } from "@ant-design/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { PILGRIM_EVENT_LABEL, isRegistered, pilgrimActionError } from "@/lib/hajj";
import { invoiceHref, INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import type { PilgrimView } from "@/server/services/hajj/pilgrimService";
import { StatusTag } from "@/components/StatusTag";
import { PilgrimStatusTag } from "./PilgrimStatusTag";
import { RegisterButton } from "./RegisterButton";

interface Props {
  pilgrim: PilgrimView;
  canEdit: boolean;
  canManage: boolean;
  canRefund: boolean;
  today: string;
}

export function PilgrimProfile({ pilgrim: p, canEdit, canManage, canRefund, today }: Props) {
  const d = (v: string | null) => (v ? formatDate(v) : "-");
  const text = (v: string | null | undefined) => v || "-";
  const cancelStage = isRegistered(p) ? "cancelregistration" : "cancelpreregistration";
  const liveInvoices = p.invoiceLines.filter((l) =>
    ["POSTED", "PARTIAL", "PAID"].includes(l.invoice.status),
  );

  return (
    <>
      <Link href="/hajj/registration" style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> Hajj Registration
      </Link>
      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="flex-start" wrap gap={16}>
          <Space direction="vertical" size={2}>
            <Space>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {p.name}
              </Typography.Title>
              <PilgrimStatusTag status={p.status} />
            </Space>
            <Typography.Text>
              Hajj {p.hajjYear} · paid by{" "}
              <Link href={`/clients/${p.client.id}`}>{p.client.name}</Link>{" "}
              <Typography.Text type="secondary">({p.client.code})</Typography.Text>
            </Typography.Text>
            <Typography.Text type="secondary">
              {[p.group?.name, p.moallem && `Moallem: ${p.moallem}`].filter(Boolean).join(" · ") ||
                "No group yet"}
            </Typography.Text>
          </Space>
          <Space wrap>
            {canEdit && !pilgrimActionError("REGISTER", p) && (
              <RegisterButton
                pilgrimId={p.id}
                name={p.name}
                trackingNo={p.trackingNo}
                today={today}
              />
            )}
            {canEdit && (
              <Link href={`/hajj/pilgrims/${p.id}/edit`}>
                <Button icon={<EditOutlined />}>Edit</Button>
              </Link>
            )}
            {canManage &&
              !pilgrimActionError(isRegistered(p) ? "CANCEL_REG" : "CANCEL_PRE_REG", p) && (
                <Link href={`/hajj/management/${cancelStage}?pilgrim=${p.id}`}>
                  <Button danger icon={<StopOutlined />}>
                    Cancel {isRegistered(p) ? "registration" : "pre registration"}
                  </Button>
                </Link>
              )}
          </Space>
        </Flex>
        {p.status === "CANCELLED" && (
          <Alert
            style={{ marginTop: 16 }}
            type="error"
            showIcon
            message={`Cancelled on ${d(p.cancelledDate)}: ${p.cancelReason ?? ""}`}
            description={
              canRefund && liveInvoices.length > 0 ? (
                <Space wrap>
                  Refund:
                  {liveInvoices.map((l) => (
                    <Link key={l.id} href={`/refunds/otherpackagehajj/new?invoice=${l.invoice.id}`}>
                      {l.invoice.number}
                    </Link>
                  ))}
                </Space>
              ) : undefined
            }
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} xl={14}>
          <Card title="Details" style={{ marginBottom: 16 }}>
            <Descriptions
              size="small"
              column={{ xs: 1, md: 2 }}
              items={[
                { key: "tr", label: "Tracking no.", children: text(p.trackingNo) },
                {
                  key: "pre",
                  label: "Pre registration",
                  children:
                    [p.preRegNo, p.preRegDate && formatDate(p.preRegDate)]
                      .filter(Boolean)
                      .join(" · ") || "-",
                },
                {
                  key: "reg",
                  label: "Registration",
                  children: p.regNo ? `${p.regNo} · ${d(p.regDate)}` : "-",
                },
                { key: "v", label: "Voucher no.", children: text(p.voucherNo) },
                {
                  key: "pp",
                  label: "Passport",
                  children: p.passportNo ? `${p.passportNo} · expires ${d(p.passportExpiry)}` : "-",
                },
                { key: "nid", label: "NID", children: text(p.nidNo) },
                {
                  key: "g",
                  label: "Gender",
                  children: p.gender ? (p.gender === "MALE" ? "Male" : "Female") : "-",
                },
                { key: "dob", label: "Date of birth", children: d(p.dateOfBirth) },
                { key: "ph", label: "Phone", children: text(p.phone) },
                {
                  key: "m",
                  label: "Maharam",
                  children: p.maharamName
                    ? `${p.maharamName}${p.maharam ? ` (${p.maharam.name})` : ""}`
                    : "-",
                },
                ...(p.transferredFrom
                  ? [{ key: "tf", label: "Transferred from", children: p.transferredFrom }]
                  : []),
                ...(p.transferredTo
                  ? [{ key: "tt", label: "Transferred to", children: p.transferredTo }]
                  : []),
                { key: "ad", label: "Address", children: text(p.address), span: 2 },
                ...(p.note ? [{ key: "n", label: "Note", children: p.note, span: 2 }] : []),
              ]}
            />
          </Card>
          <Card title="Invoices" style={{ marginBottom: 16 }}>
            {p.invoiceLines.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Not billed yet" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={p.invoiceLines}
                columns={[
                  { title: "Date", key: "d", render: (_, l) => formatDate(l.invoice.date) },
                  {
                    title: "Invoice",
                    key: "n",
                    render: (_, l) => (
                      <Link href={invoiceHref(l.invoice.type, l.invoice.id) ?? "#"}>
                        {l.invoice.number}
                      </Link>
                    ),
                  },
                  {
                    title: "Type",
                    key: "t",
                    render: (_, l) => INVOICE_TYPE_INFO[l.invoice.type as InvoiceTypeKey]?.label,
                  },
                  { title: "Line", dataIndex: "description", key: "desc" },
                  {
                    title: "Amount",
                    dataIndex: "clientPrice",
                    key: "a",
                    align: "right",
                    render: (v: string) => formatMoney(v),
                  },
                  {
                    title: "Status",
                    key: "s",
                    render: (_, l) => <StatusTag status={l.invoice.status} />,
                  },
                ]}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="History" style={{ marginBottom: 16 }}>
            <Timeline
              items={p.events.map((e) => ({
                key: e.id,
                children: (
                  <>
                    <Typography.Text strong>
                      {PILGRIM_EVENT_LABEL[e.type] ?? e.type}
                    </Typography.Text>{" "}
                    <Typography.Text type="secondary">{formatDate(e.date)}</Typography.Text>
                    {(e.fromValue || e.toValue) && (
                      <div>
                        {e.fromValue ?? "-"} → {e.toValue ?? "-"}
                      </div>
                    )}
                    {e.note && <div style={{ color: "#888" }}>{e.note}</div>}
                  </>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
