"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Flex,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SwapOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { calcQuotation } from "@/lib/calc/quotation";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_TYPE_INFO, invoiceHref, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import type { ListParams } from "@/lib/listParams";
import type { FieldOption } from "@/lib/masters";
import type {
  QuotationList,
  QuotationRow,
  QuotationView,
} from "@/server/services/quotations/quotationService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import {
  convertQuotationAction,
  saveQuotationAction,
  setQuotationStatusAction,
} from "@/app/(app)/documents/actions";

const STATUS: Record<string, { color: string; label: string }> = {
  DRAFT: { color: "default", label: "Draft" },
  SENT: { color: "blue", label: "Sent" },
  ACCEPTED: { color: "green", label: "Accepted" },
  REJECTED: { color: "red", label: "Rejected" },
  CONVERTED: { color: "purple", label: "Invoiced" },
  EXPIRED: { color: "orange", label: "Expired" },
};

export function QuotationStatusTag({ status }: { status: string }) {
  return <Tag color={STATUS[status]?.color}>{STATUS[status]?.label ?? status}</Tag>;
}

const TYPE_OPTIONS = (["OTHER", "OTHER_PACKAGE", "TOUR"] as const).map((t) => ({
  value: t,
  label: INVOICE_TYPE_INFO[t].label,
}));

// ─── List ───────────────────────────────────────────────────────────────────

export function QuotationListPage({
  data,
  params,
  status,
  canCreate,
}: {
  data: QuotationList;
  params: ListParams;
  status?: string;
  canCreate: boolean;
}) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);
  const columns: TableColumnsType<QuotationRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "d",
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: "Quotation",
      key: "n",
      render: (_, r) => <Link href={`/quotations/${r.id}`}>{r.number}</Link>,
    },
    {
      title: "Client",
      key: "c",
      render: (_, r) => <Link href={`/clients/${r.clientId}`}>{r.clientName}</Link>,
    },
    { title: "Subject", dataIndex: "subject", key: "s", render: (v: string | null) => v ?? "-" },
    {
      title: "Valid until",
      dataIndex: "validUntil",
      key: "v",
      render: (v: string) => formatDate(v),
    },
    {
      title: "Amount",
      dataIndex: "netTotal",
      key: "a",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Status",
      key: "st",
      render: (_, r) => (
        <>
          <QuotationStatusTag status={r.status} />
          {r.convertedInvoice && (
            <Link href={invoiceHref(r.convertedInvoice.type, r.convertedInvoice.id) ?? "#"}>
              {r.convertedInvoice.number}
            </Link>
          )}
        </>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Priced offers to clients. They post nothing until converted to an invoice."
        extra={
          canCreate && (
            <Link href="/quotations/new">
              <Button type="primary" icon={<PlusOutlined />}>
                New quotation
              </Button>
            </Link>
          )
        }
      />
      <Card>
        <Flex gap={12} wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Number, subject or client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 280 }}
          />
          <Select
            style={{ width: 160 }}
            value={status ?? ""}
            onChange={(v) => setParams({ quoteStatus: v })}
            options={[
              { value: "", label: "Any status" },
              { value: "OPEN", label: "Open" },
              ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
            ]}
            aria-label="Status"
          />
          <DateRangeFilter from={params.from} to={params.to} />
        </Flex>
        <DataTable<QuotationRow>
          rows={data.rows}
          total={data.total}
          page={params.page}
          pageSize={params.pageSize}
          columns={columns}
        />
      </Card>
    </>
  );
}

// ─── Form ───────────────────────────────────────────────────────────────────

interface Line {
  description?: string;
  qty?: string;
  unitPrice?: string;
  unitCost?: string;
  vendorId?: string | null;
  productId?: string | null;
}

interface Values {
  clientId?: string;
  date?: Dayjs;
  validUntil?: Dayjs;
  subject?: string | null;
  invoiceType?: string;
  discount?: string;
  note?: string | null;
  terms?: string | null;
  lines?: Line[];
}

export function QuotationForm({
  quotationId,
  number,
  initial,
  products,
  today,
  defaultTerms,
}: {
  quotationId?: string;
  number?: string;
  initial?: Omit<Values, "date" | "validUntil"> & { date: string; validUntil: string };
  products: FieldOption[];
  today: string;
  defaultTerms: string | null;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [pending, startTransition] = useTransition();
  const values = Form.useWatch([], form) as Values | undefined;

  const totals = useMemo(() => {
    try {
      return calcQuotation(
        (values?.lines ?? []).map((l) => ({
          qty: l?.qty || 0,
          unitPrice: l?.unitPrice || 0,
          unitCost: l?.unitCost || 0,
        })),
        values?.discount || 0,
      );
    } catch {
      return null;
    }
  }, [values]);

  function submit() {
    form
      .validateFields()
      .then((v) =>
        startTransition(async () => {
          const r = await saveQuotationAction(quotationId ?? null, {
            ...v,
            date: v.date?.format("YYYY-MM-DD"),
            validUntil: v.validUntil?.format("YYYY-MM-DD"),
          });
          if (!applyActionResult(r, form, message)) return;
          if (!r.ok) return;
          message.success(`${r.data.number} saved`);
          router.push(`/quotations/${r.data.id}`);
          router.refresh();
        }),
      )
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  return (
    <>
      <PageHeader title={quotationId ? `Edit ${number}` : "New Quotation"} />
      <Form<Values>
        form={form}
        name="quotation"
        layout="vertical"
        requiredMark="optional"
        initialValues={
          initial
            ? { ...initial, date: dayjs(initial.date), validUntil: dayjs(initial.validUntil) }
            : {
                date: dayjs(today),
                validUntil: dayjs(today).add(7, "day"),
                invoiceType: "OTHER",
                terms: defaultTerms ?? undefined,
                lines: [{ qty: "1" }],
              }
        }
      >
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Client"
                name="clientId"
                rules={[{ required: true, message: "Choose a client" }]}
              >
                <PartySelect party="clients" id="quotation_clientId" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Date" name="date" rules={[{ required: true, message: "Required" }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item
                label="Valid until"
                name="validUntil"
                rules={[{ required: true, message: "Required" }]}
              >
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Becomes invoice"
                name="invoiceType"
                tooltip="The invoice type it turns into when converted"
              >
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Subject" name="subject">
                <Input maxLength={150} placeholder="e.g. Cox's Bazar family trip, 3 nights" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Lines" style={{ marginBottom: 16 }}>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f, i) => (
                  <Row key={f.key} gutter={10} align="bottom" className="line-row">
                    <Col xs={24} md={12} xl={7}>
                      <Form.Item
                        label="Description"
                        name={[f.name, "description"]}
                        rules={[{ required: true, message: "Required" }]}
                      >
                        <Input maxLength={300} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6} xl={4}>
                      <Form.Item label="Product" name={[f.name, "productId"]}>
                        <Select allowClear showSearch optionFilterProp="label" options={products} />
                      </Form.Item>
                    </Col>
                    <Col xs={6} md={3} xl={2}>
                      <Form.Item
                        label="Qty"
                        name={[f.name, "qty"]}
                        rules={[{ required: true, message: "Required" }]}
                      >
                        <MoneyInput precision={2} />
                      </Form.Item>
                    </Col>
                    <Col xs={9} md={5} xl={3}>
                      <Form.Item
                        label="Unit price"
                        name={[f.name, "unitPrice"]}
                        rules={[{ required: true, message: "Required" }]}
                      >
                        <MoneyInput />
                      </Form.Item>
                    </Col>
                    <Col xs={9} md={5} xl={3}>
                      <Form.Item
                        label="Unit cost"
                        name={[f.name, "unitCost"]}
                        tooltip="Not shown to the client"
                      >
                        <MoneyInput placeholder="0.00" />
                      </Form.Item>
                    </Col>
                    <Col xs={20} md={8} xl={4}>
                      <Form.Item label="Vendor" name={[f.name, "vendorId"]}>
                        <PartySelect
                          party="vendors"
                          id={`quotation_vendor_${i}`}
                          placeholder="For the cost"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={4} md={2} xl={1}>
                      <Form.Item label=" ">
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`Remove line ${i + 1}`}
                          disabled={fields.length === 1}
                          onClick={() => remove(f.name)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({ qty: "1" })}
                >
                  Add line
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        <Row gutter={16}>
          <Col xs={24} xl={14}>
            <Card style={{ marginBottom: 16 }}>
              <Form.Item label="Note to the client" name="note">
                <Input.TextArea rows={2} maxLength={1000} />
              </Form.Item>
              <Form.Item label="Terms" name="terms">
                <Input.TextArea rows={3} maxLength={2000} />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card style={{ marginBottom: 16 }}>
              <Form.Item label="Discount" name="discount">
                <MoneyInput placeholder="0.00" />
              </Form.Item>
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "s",
                    label: "Subtotal",
                    children: totals ? formatMoney(totals.subtotal.toFixed(2)) : "-",
                  },
                  {
                    key: "t",
                    label: "Total",
                    children: (
                      <strong>{totals ? formatMoney(totals.netTotal.toFixed(2)) : "-"}</strong>
                    ),
                  },
                  {
                    key: "m",
                    label: "Margin (internal)",
                    children: totals ? (
                      <Typography.Text type={totals.margin.isNegative() ? "danger" : "success"}>
                        {formatMoney(totals.margin.toFixed(2))}
                      </Typography.Text>
                    ) : (
                      "-"
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
        <Flex gap={8} justify="flex-end" style={{ marginBottom: 24 }}>
          <Link href={quotationId ? `/quotations/${quotationId}` : "/quotations"}>
            <Button>Cancel</Button>
          </Link>
          <Button type="primary" loading={pending} onClick={submit}>
            Save quotation
          </Button>
        </Flex>
      </Form>
    </>
  );
}

// ─── View ───────────────────────────────────────────────────────────────────

export function QuotationDetail({
  q,
  canEdit,
  canConvert,
}: {
  q: QuotationView;
  canEdit: boolean;
  canConvert: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [busy, startBusy] = useTransition();
  const open = q.status !== "CONVERTED";

  function setStatus(status: "SENT" | "ACCEPTED" | "REJECTED") {
    startBusy(async () => {
      const r = await setQuotationStatusAction(q.id, { status });
      if (applyActionResult(r, null, message, `Marked ${STATUS[status]!.label.toLowerCase()}`))
        router.refresh();
    });
  }

  function convert() {
    startBusy(async () => {
      const r = await convertQuotationAction(q.id);
      if (!applyActionResult(r, null, message, "Draft invoice created")) return;
      if (!r.ok) return;
      const path = INVOICE_TYPE_INFO[r.data.invoiceType as InvoiceTypeKey].path;
      router.push(`${path}/${r.data.invoiceId}/edit`);
    });
  }

  const shareText = encodeURIComponent(
    `Quotation ${q.number}${q.subject ? `: ${q.subject}` : ""}\nTotal BDT ${formatMoney(q.netTotal)}, valid until ${formatDate(q.validUntil)}.`,
  );
  const phone = q.client.phone?.replace(/[^\d]/g, "").replace(/^0/, "880");

  return (
    <>
      <Link href="/quotations" style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> Quotations
      </Link>
      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" wrap gap={16}>
          <Space direction="vertical" size={2}>
            <Space>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {q.number}
              </Typography.Title>
              <QuotationStatusTag status={q.shownStatus} />
            </Space>
            <Typography.Text>
              <Link href={`/clients/${q.client.id}`}>{q.client.name}</Link>{" "}
              <Typography.Text type="secondary">({q.client.code})</Typography.Text>
            </Typography.Text>
            <Typography.Text type="secondary">
              {formatDate(q.date)} · valid until {formatDate(q.validUntil)} · becomes{" "}
              {INVOICE_TYPE_INFO[q.invoiceType as InvoiceTypeKey].label} invoice
            </Typography.Text>
            {q.subject && <Typography.Text strong>{q.subject}</Typography.Text>}
          </Space>
          <Space wrap>
            <Button icon={<FilePdfOutlined />} href={`/api/pdf/quotation/${q.id}`} target="_blank">
              PDF
            </Button>
            <Button
              icon={<WhatsAppOutlined />}
              href={`https://wa.me/${phone ?? ""}?text=${shareText}`}
              target="_blank"
              rel="noreferrer"
            >
              Share
            </Button>
            {canEdit && open && (q.status === "DRAFT" || q.status === "REJECTED") && (
              <Button loading={busy} onClick={() => setStatus("SENT")}>
                Mark sent
              </Button>
            )}
            {canEdit && open && (q.status === "DRAFT" || q.status === "SENT") && (
              <Button loading={busy} onClick={() => setStatus("ACCEPTED")}>
                Accepted
              </Button>
            )}
            {canEdit && open && q.status !== "REJECTED" && (
              <Button danger loading={busy} onClick={() => setStatus("REJECTED")}>
                Rejected
              </Button>
            )}
            {canEdit && open && (
              <Link href={`/quotations/${q.id}/edit`}>
                <Button icon={<EditOutlined />}>Edit</Button>
              </Link>
            )}
            {canConvert && open && q.status !== "REJECTED" && (
              <Popconfirm
                title="Create a draft invoice from this quotation?"
                description="You can review it before posting."
                onConfirm={convert}
              >
                <Button type="primary" icon={<SwapOutlined />} loading={busy}>
                  Convert to invoice
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Flex>
        {q.convertedInvoice && (
          <Alert
            style={{ marginTop: 16 }}
            type="success"
            showIcon
            message={
              <>
                Invoiced as{" "}
                <Link href={invoiceHref(q.convertedInvoice.type, q.convertedInvoice.id) ?? "#"}>
                  {q.convertedInvoice.number}
                </Link>
              </>
            }
          />
        )}
      </Card>
      <Card title="Lines" style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={q.lines}
          scroll={{ x: "max-content" }}
          columns={[
            {
              title: "Description",
              key: "d",
              render: (_, l) => (
                <>
                  {l.description}
                  {l.product && <div style={{ fontSize: 12, color: "#888" }}>{l.product}</div>}
                </>
              ),
            },
            { title: "Qty", dataIndex: "qty", align: "right" },
            {
              title: "Unit price",
              dataIndex: "unitPrice",
              align: "right",
              render: (v: string) => formatMoney(v),
            },
            {
              title: "Amount",
              dataIndex: "amount",
              align: "right",
              render: (v: string) => <strong>{formatMoney(v)}</strong>,
            },
            {
              title: "Cost (internal)",
              key: "c",
              align: "right",
              render: (_, l) =>
                l.unitCost === "0.00" ? "-" : `${formatMoney(l.unitCost)} · ${l.vendor ?? ""}`,
            },
          ]}
        />
      </Card>
      <Row gutter={16}>
        <Col xs={24} xl={14}>
          {(q.note || q.terms) && (
            <Card style={{ marginBottom: 16 }}>
              {q.note && <Typography.Paragraph>{q.note}</Typography.Paragraph>}
              {q.terms && (
                <Typography.Paragraph
                  type="secondary"
                  style={{ whiteSpace: "pre-line", marginBottom: 0 }}
                >
                  {q.terms}
                </Typography.Paragraph>
              )}
            </Card>
          )}
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Totals" style={{ marginBottom: 16 }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: "s", label: "Subtotal", children: formatMoney(q.subtotal) },
                ...(q.discount !== "0.00"
                  ? [{ key: "d", label: "Discount", children: `- ${formatMoney(q.discount)}` }]
                  : []),
                { key: "t", label: "Total", children: <strong>{formatMoney(q.netTotal)}</strong> },
                { key: "c", label: "Cost (internal)", children: formatMoney(q.cost) },
                {
                  key: "m",
                  label: "Margin (internal)",
                  children: (
                    <Typography.Text type={q.margin.startsWith("-") ? "danger" : "success"}>
                      {formatMoney(q.margin)}
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
