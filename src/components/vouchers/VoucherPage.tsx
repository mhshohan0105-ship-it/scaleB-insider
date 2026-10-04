"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Upload,
} from "antd";
import type { TableColumnsType, UploadFile } from "antd";
import { PaperClipOutlined, UploadOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { FieldOption, PartyKey } from "@/lib/masters";
import type { VoucherKindKey } from "@/lib/schemas/money";
import { ADJUST_DIRECTION_LABEL, VOUCHER_KIND_INFO } from "@/lib/voucherKinds";
import type { VoucherList, VoucherRow } from "@/server/services/vouchers/voucherService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import { createVoucherAction, voidVoucherAction } from "@/app/(app)/vouchers/actions";

export interface VoucherPageOptions {
  accounts: FieldOption[];
  expenseHeads?: FieldOption[];
  employees?: FieldOption[];
  investments?: (FieldOption & { left: string })[];
}

interface Props {
  kind: VoucherKindKey;
  title?: string;
  description?: string;
  data: VoucherList;
  params: ListParams;
  options: VoucherPageOptions;
  canCreate: boolean;
  canVoid: boolean;
  today: string;
  /** Show the form on this page (false: the list only, e.g. Expense History). */
  withForm?: boolean;
  /** After saving, go here (default: stay and refresh). */
  afterSave?: string;
}

interface Values {
  date?: Dayjs;
  amount?: string;
  profit?: string;
  moneyAccountId?: string | null;
  partyType?: string | null;
  partyId?: string | null;
  expenseHeadId?: string | null;
  direction?: string | null;
  investmentId?: string | null;
  title?: string | null;
  reference?: string | null;
  note?: string | null;
  /** Incentive: received in cash or kept by the vendor. */
  received?: "MONEY" | "ADJUST";
  /** Investments page: invest or record a return. */
  mode?: "INVESTMENT" | "INVESTMENT_RETURN";
}

const PARTY_KEY: Record<string, PartyKey> = {
  CLIENT: "clients",
  COMBINED: "combinedclients",
  VENDOR: "vendors",
  AGENT: "agents",
};

async function upload(voucherId: string, file: File): Promise<string | null> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/attachments?voucherId=${voucherId}`, { method: "POST", body });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed";
}

export function VoucherPage({
  kind,
  title,
  description,
  data,
  params,
  options,
  canCreate,
  canVoid,
  today,
  withForm = true,
  afterSave,
}: Props) {
  const info = VOUCHER_KIND_INFO[kind];
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [form] = Form.useForm<Values>();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [search, setSearch] = useState(params.q);
  const mode = (Form.useWatch("mode", form) as Values["mode"]) ?? "INVESTMENT";
  const partyType = Form.useWatch("partyType", form) as string | undefined;
  const received = (Form.useWatch("received", form) as Values["received"]) ?? "MONEY";
  const actual: VoucherKindKey = kind === "INVESTMENT" ? mode : kind;

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const { received: rec, mode: _m, ...rest } = v;
        void _m;
        const payload = {
          ...rest,
          date: v.date?.format("YYYY-MM-DD"),
          moneyAccountId: kind === "INCENTIVE_INCOME" && rec === "ADJUST" ? null : v.moneyAccountId,
        };
        startTransition(async () => {
          const result = await createVoucherAction(actual, payload);
          if (!applyActionResult(result, form, message)) return;
          if (!result.ok) return;
          for (const f of files) {
            const error = f.originFileObj ? await upload(result.data.id, f.originFileObj) : null;
            if (error) message.warning(`${f.name}: ${error}`);
          }
          message.success(`${result.data.number} saved`);
          form.resetFields();
          setFiles([]);
          if (afterSave) router.push(afterSave);
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  const accountField = (label = "Account") => (
    <Form.Item
      label={label}
      name="moneyAccountId"
      rules={[{ required: true, message: "Choose the account" }]}
    >
      <Select showSearch optionFilterProp="label" options={options.accounts} />
    </Form.Item>
  );

  const fields = (
    <Row gutter={16}>
      {kind === "INVESTMENT" && (
        <Col xs={24}>
          <Form.Item name="mode">
            <Radio.Group
              optionType="button"
              options={[
                { value: "INVESTMENT", label: "Invest" },
                { value: "INVESTMENT_RETURN", label: "Record a return" },
              ]}
            />
          </Form.Item>
        </Col>
      )}
      {actual === "EXPENSE" && (
        <Col xs={24} md={12} xl={8}>
          <Form.Item
            label="Expense head"
            name="expenseHeadId"
            rules={[{ required: true, message: "Choose the head" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={options.expenseHeads}
              notFoundContent={<Link href="/expenses/heads">Add expense heads first</Link>}
            />
          </Form.Item>
        </Col>
      )}
      {actual === "INCENTIVE_INCOME" && (
        <>
          <Col xs={24} md={12} xl={8}>
            <Form.Item
              label="From vendor / airline"
              name="partyId"
              rules={[{ required: true, message: "Choose the vendor" }]}
            >
              <PartySelect party="vendors" id="voucher_vendor" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Form.Item label="Received as" name="received">
              <Radio.Group
                options={[
                  { value: "MONEY", label: "Money into an account" },
                  { value: "ADJUST", label: "Less to pay the vendor" },
                ]}
              />
            </Form.Item>
          </Col>
        </>
      )}
      {actual === "AGENT_PAYMENT" && (
        <Col xs={24} md={12} xl={8}>
          <Form.Item
            label="Agent"
            name="partyId"
            rules={[{ required: true, message: "Choose the agent" }]}
          >
            <PartySelect party="agents" id="voucher_agent" />
          </Form.Item>
        </Col>
      )}
      {actual === "EMPLOYEE_ADVANCE" && (
        <Col xs={24} md={12} xl={8}>
          <Form.Item
            label="Employee"
            name="partyId"
            rules={[{ required: true, message: "Choose the employee" }]}
          >
            <Select showSearch optionFilterProp="label" options={options.employees} />
          </Form.Item>
        </Col>
      )}
      {actual === "BILL_ADJUSTMENT" && (
        <>
          <Col xs={12} md={6} xl={4}>
            <Form.Item
              label="Party type"
              name="partyType"
              rules={[{ required: true, message: "Required" }]}
            >
              <Select
                options={[
                  { value: "CLIENT", label: "Client" },
                  { value: "COMBINED", label: "Combined client" },
                  { value: "VENDOR", label: "Vendor" },
                  { value: "AGENT", label: "Agent" },
                ]}
                onChange={() => form.setFieldValue("partyId", null)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Form.Item
              label="Party"
              name="partyId"
              rules={[{ required: true, message: "Choose the party" }]}
            >
              <PartySelect
                key={partyType ?? "none"}
                party={PARTY_KEY[partyType ?? "CLIENT"] ?? "clients"}
                id="voucher_party"
                disabled={!partyType}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Form.Item
              label="Their due"
              name="direction"
              rules={[{ required: true, message: "Choose" }]}
            >
              <Radio.Group
                options={[
                  { value: "INCREASE_DUE", label: ADJUST_DIRECTION_LABEL.INCREASE_DUE },
                  { value: "DECREASE_DUE", label: ADJUST_DIRECTION_LABEL.DECREASE_DUE },
                ]}
              />
            </Form.Item>
          </Col>
        </>
      )}
      {actual === "INVESTMENT" && (
        <Col xs={24} md={12} xl={8}>
          <Form.Item
            label="Investment"
            name="title"
            rules={[{ required: true, message: "Name it" }]}
          >
            <Input maxLength={120} placeholder="e.g. FDR City Bank" />
          </Form.Item>
        </Col>
      )}
      {actual === "INVESTMENT_RETURN" && (
        <Col xs={24} md={12} xl={8}>
          <Form.Item
            label="Investment"
            name="investmentId"
            rules={[{ required: true, message: "Choose the investment" }]}
          >
            <Select showSearch optionFilterProp="label" options={options.investments} />
          </Form.Item>
        </Col>
      )}
      <Col xs={12} md={6} xl={4}>
        <Form.Item label="Amount" name="amount" rules={[{ required: true, message: "Required" }]}>
          <MoneyInput />
        </Form.Item>
      </Col>
      {actual === "INVESTMENT_RETURN" && (
        <Col xs={12} md={6} xl={4}>
          <Form.Item label="Gain" name="profit">
            <MoneyInput placeholder="0.00" />
          </Form.Item>
        </Col>
      )}
      {actual !== "BILL_ADJUSTMENT" &&
        !(actual === "INCENTIVE_INCOME" && received === "ADJUST") && (
          <Col xs={24} md={12} xl={6}>
            {accountField(info.moneyOut || actual === "INVESTMENT" ? "Paid from" : "Received into")}
          </Col>
        )}
      <Col xs={12} md={6} xl={4}>
        <Form.Item label="Date" name="date" rules={[{ required: true, message: "Required" }]}>
          <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6} xl={4}>
        <Form.Item label="Reference" name="reference">
          <Input maxLength={80} />
        </Form.Item>
      </Col>
      <Col xs={24} xl={actual === "EXPENSE" ? 10 : 12}>
        <Form.Item
          label={actual === "BILL_ADJUSTMENT" ? "Reason" : "Note"}
          name="note"
          rules={
            actual === "BILL_ADJUSTMENT"
              ? [{ required: true, min: 3, message: "Give the reason" }]
              : []
          }
        >
          <Input maxLength={500} />
        </Form.Item>
      </Col>
      {actual === "EXPENSE" && (
        <Col xs={24} xl={6}>
          <Form.Item label="Bill / receipt (PDF or image, up to 2 MB)">
            <Upload
              fileList={files}
              beforeUpload={() => false}
              onChange={({ fileList }) => setFiles(fileList.slice(-3))}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
            >
              <Button icon={<UploadOutlined />}>Attach</Button>
            </Upload>
          </Form.Item>
        </Col>
      )}
    </Row>
  );

  const money = (v: string) => formatMoney(v);
  const columns: TableColumnsType<VoucherRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (v: string) => formatDate(v),
    },
    { title: "Number", dataIndex: "number", key: "number" },
    {
      title:
        kind === "EXPENSE"
          ? "Head"
          : kind === "INVESTMENT"
            ? "Investment"
            : kind === "NON_INVOICE_INCOME"
              ? "Note"
              : "Party",
      key: "what",
      render: (_, r) => {
        if (r.kind === "EXPENSE") return r.expenseHead;
        if (r.kind === "INVESTMENT") return r.title;
        if (r.kind === "INVESTMENT_RETURN") return `Return of ${r.investmentNumber}`;
        if (r.kind === "NON_INVOICE_INCOME") return r.note ?? "-";
        const href =
          r.partyType === "CLIENT"
            ? `/clients/${r.partyId}`
            : r.partyType === "VENDOR"
              ? `/vendors/${r.partyId}`
              : r.partyType === "AGENT"
                ? `/agents/${r.partyId}`
                : r.partyType === "COMBINED"
                  ? `/clients/combined/${r.partyId}`
                  : null;
        return (
          <>
            {href ? <Link href={href}>{r.partyName}</Link> : r.partyName}
            {r.direction && (
              <div style={{ fontSize: 12, color: "#888" }}>
                {ADJUST_DIRECTION_LABEL[r.direction]}
              </div>
            )}
          </>
        );
      },
    },
    { title: "Amount", dataIndex: "amount", key: "amount", align: "right", render: money },
    ...(kind === "INVESTMENT"
      ? [
          {
            title: "Gain / still invested",
            key: "inv",
            align: "right" as const,
            render: (_: unknown, r: VoucherRow) =>
              r.kind === "INVESTMENT_RETURN"
                ? money(r.profit)
                : r.outstanding
                  ? money(r.outstanding)
                  : "-",
          },
        ]
      : []),
    {
      title: "Account",
      dataIndex: "moneyAccount",
      key: "acc",
      render: (v: string | null) => v ?? (kind === "INCENTIVE_INCOME" ? "Against vendor due" : "-"),
    },
    {
      title: kind === "BILL_ADJUSTMENT" ? "Reason" : "Reference / note",
      key: "note",
      render: (_, r) => (
        <>
          {[r.reference, kind !== "NON_INVOICE_INCOME" ? r.note : null]
            .filter(Boolean)
            .join(" · ") || "-"}
          {r.attachments.map((a) => (
            <div key={a.id}>
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                <PaperClipOutlined /> {a.fileName}
              </a>
            </div>
          ))}
        </>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => <DocumentStatusTag status={r.status} reason={r.voidReason} />,
    },
    ...(canVoid
      ? [
          {
            title: "",
            key: "void",
            render: (_: unknown, r: VoucherRow) =>
              r.status === "POSTED" && (
                <VoidButton
                  what={r.number}
                  buttonProps={{ size: "small" }}
                  onVoid={(v) => voidVoucherAction(r.kind, r.id, v)}
                />
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title={title ?? info.label} description={description} />
      {withForm && canCreate && (
        <Card style={{ marginBottom: 16 }}>
          <Form<Values>
            form={form}
            name="voucher"
            layout="vertical"
            requiredMark="optional"
            initialValues={{ date: dayjs(today), received: "MONEY", mode: "INVESTMENT" }}
          >
            {fields}
            <Flex justify="flex-end">
              <Button type="primary" loading={pending} onClick={submit}>
                Save
              </Button>
            </Flex>
          </Form>
        </Card>
      )}
      <Card>
        <Flex gap={12} wrap style={{ marginBottom: 12 }} align="center">
          <Input.Search
            allowClear
            placeholder="Number, reference or note"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 280 }}
          />
          <DateRangeFilter from={params.from} to={params.to} />
          {kind === "EXPENSE" && options.expenseHeads && (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="All heads"
              style={{ width: 200 }}
              options={options.expenseHeads}
              defaultValue={undefined}
              onChange={(v) => setParams({ expenseHeadId: v ?? "" })}
              aria-label="Filter by head"
            />
          )}
          <Space style={{ marginLeft: "auto" }} size="large">
            <Statistic title="Total (excl. void)" value={formatMoney(data.totals.amount)} />
            {kind === "INVESTMENT" && (
              <Statistic title="Gains" value={formatMoney(data.totals.profit)} />
            )}
          </Space>
        </Flex>
        <DataTable<VoucherRow>
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
