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
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ArrowLeftOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { FieldOption } from "@/lib/masters";
import type {
  LoanList,
  LoanPaymentList,
  LoanRow,
  LoanView,
} from "@/server/services/loans/loanService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import {
  createLoanAction,
  createLoanPaymentAction,
  saveLoanAuthorityAction,
  voidLoanAction,
  voidLoanPaymentAction,
} from "@/app/(app)/vouchers/actions";

const KIND_LABEL: Record<string, string> = {
  TAKEN: "Loan taken",
  GIVEN: "Loan given",
  INVESTMENT: "Investment received",
};

const STATUS_COLOR: Record<string, string> = { ACTIVE: "blue", CLOSED: "green", VOID: "red" };
export function LoanStatusTag({ status }: { status: string }) {
  return (
    <Tag color={STATUS_COLOR[status]}>
      {status === "ACTIVE" ? "Active" : status === "CLOSED" ? "Repaid" : "Void"}
    </Tag>
  );
}

// ─── Authorities ────────────────────────────────────────────────────────────

interface Authority {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  balance: string;
}

export function AuthoritiesPage({
  rows,
  canCreate,
  canEdit,
}: {
  rows: Authority[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<Authority | "new" | null>(null);
  const [saving, setSaving] = useState(false);

  function open(a: Authority | "new") {
    setEditing(a);
    form.setFieldsValue(
      a === "new" ? { type: "BANK", name: "", phone: "", address: "", note: "" } : a,
    );
  }
  async function save() {
    const v = await form.validateFields();
    setSaving(true);
    const r = await saveLoanAuthorityAction(editing === "new" ? null : editing!.id, v);
    setSaving(false);
    if (applyActionResult(r, form, message, "Saved")) {
      setEditing(null);
      router.refresh();
    }
  }

  return (
    <>
      <PageHeader
        title="Loan Authorities"
        description="Banks, people and companies you borrow from, lend to, or receive investment from."
        extra={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>
              Add authority
            </Button>
          )
        }
      />
      <Card>
        <Table<Authority>
          rowKey="id"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: "Name", dataIndex: "name", key: "name" },
            {
              title: "Type",
              dataIndex: "type",
              key: "type",
              render: (v: string) => v.charAt(0) + v.slice(1).toLowerCase(),
            },
            {
              title: "Phone",
              dataIndex: "phone",
              key: "phone",
              render: (v: string | null) => v ?? "-",
            },
            {
              title: "Balance",
              dataIndex: "balance",
              key: "balance",
              align: "right",
              render: (v: string) =>
                v === "0.00"
                  ? "-"
                  : v.startsWith("-")
                    ? `${formatMoney(v.slice(1))} we owe`
                    : `${formatMoney(v)} owed to us`,
            },
            ...(canEdit
              ? [
                  {
                    title: "",
                    key: "e",
                    render: (_: unknown, a: Authority) => (
                      <Button size="small" onClick={() => open(a)}>
                        Edit
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <Modal
        open={editing !== null}
        title={editing === "new" ? "Add authority" : "Edit authority"}
        okText="Save"
        okButtonProps={{ loading: saving }}
        onOk={save}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, min: 2, message: "Required" }]}
          >
            <Input maxLength={120} autoFocus />
          </Form.Item>
          <Form.Item label="Type" name="type">
            <Radio.Group
              options={[
                { value: "BANK", label: "Bank" },
                { value: "PERSON", label: "Person" },
                { value: "COMPANY", label: "Company" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Phone" name="phone">
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item label="Address" name="address">
            <Input maxLength={300} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ─── Loans / received investments ───────────────────────────────────────────

interface LoansPageProps {
  kinds: ("TAKEN" | "GIVEN" | "INVESTMENT")[];
  title: string;
  description: string;
  data: LoanList;
  params: ListParams;
  authorities: FieldOption[];
  accounts: FieldOption[];
  canCreate: boolean;
  canVoid: boolean;
  today: string;
}

export function LoansPage({
  kinds,
  title,
  description,
  data,
  params,
  authorities,
  accounts,
  canCreate,
  canVoid,
  today,
}: LoansPageProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.q);
  const kind = (Form.useWatch("kind", form) as string) ?? kinds[0];

  function submit() {
    form
      .validateFields()
      .then((v: Record<string, unknown>) =>
        startTransition(async () => {
          const r = await createLoanAction({ ...v, date: (v.date as Dayjs).format("YYYY-MM-DD") });
          if (!applyActionResult(r, form, message)) return;
          if (!r.ok) return;
          message.success(`${r.data.number} saved`);
          form.resetFields();
          router.refresh();
        }),
      )
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  const columns: TableColumnsType<LoanRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: "Number",
      key: "n",
      render: (_, r) => <Link href={`/loans/${r.id}`}>{r.number}</Link>,
    },
    ...(kinds.length > 1
      ? [{ title: "Kind", key: "k", render: (_: unknown, r: LoanRow) => KIND_LABEL[r.kind] }]
      : []),
    {
      title: kinds[0] === "INVESTMENT" ? "Investor" : "Authority",
      dataIndex: "authority",
      key: "a",
    },
    {
      title: "Principal",
      dataIndex: "principal",
      key: "p",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Rate",
      key: "r",
      align: "right",
      render: (_, r) => (r.interestRate === "0.00" ? "-" : `${r.interestRate}%`),
    },
    {
      title: "Repaid",
      dataIndex: "repaid",
      key: "rp",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Outstanding",
      dataIndex: "outstanding",
      key: "o",
      align: "right",
      render: (v: string) => <strong>{formatMoney(v)}</strong>,
    },
    {
      title: "Interest paid",
      dataIndex: "interestPaid",
      key: "i",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    { title: "Status", key: "s", render: (_, r) => <LoanStatusTag status={r.status} /> },
    ...(canVoid
      ? [
          {
            title: "",
            key: "v",
            render: (_: unknown, r: LoanRow) =>
              r.status !== "VOID" &&
              r.repaid === "0.00" && (
                <VoidButton
                  what={r.number}
                  buttonProps={{ size: "small" }}
                  onVoid={(v) => voidLoanAction(r.id, v)}
                />
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title={title} description={description} />
      {canCreate && (
        <Card style={{ marginBottom: 16 }}>
          <Form
            form={form}
            name="loan"
            layout="vertical"
            requiredMark="optional"
            initialValues={{ kind: kinds[0], date: dayjs(today) }}
          >
            <Row gutter={16}>
              {kinds.length > 1 && (
                <Col xs={24}>
                  <Form.Item name="kind">
                    <Radio.Group
                      optionType="button"
                      options={kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                    />
                  </Form.Item>
                </Col>
              )}
              {kinds.length === 1 && (
                <Form.Item name="kind" hidden>
                  <Input />
                </Form.Item>
              )}
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label={
                    kind === "INVESTMENT" ? "Investor" : kind === "GIVEN" ? "Borrower" : "Lender"
                  }
                  name="authorityId"
                  rules={[{ required: true, message: "Choose who" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={authorities}
                    notFoundContent={<Link href="/loans/authorities">Add authorities first</Link>}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label="Principal"
                  name="principal"
                  rules={[{ required: true, message: "Required" }]}
                >
                  <MoneyInput />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={3}>
                <Form.Item label="Yearly rate %" name="interestRate">
                  <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={3}>
                <Form.Item label="Term (months)" name="termMonths">
                  <InputNumber min={1} max={600} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label={kind === "GIVEN" ? "Paid from" : "Received into"}
                  name="moneyAccountId"
                  rules={[{ required: true, message: "Choose the account" }]}
                >
                  <Select showSearch optionFilterProp="label" options={accounts} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label="Date"
                  name="date"
                  rules={[{ required: true, message: "Required" }]}
                >
                  <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="Note" name="note">
                  <Input maxLength={500} />
                </Form.Item>
              </Col>
            </Row>
            <Flex justify="flex-end">
              <Button type="primary" loading={pending} onClick={submit}>
                Save
              </Button>
            </Flex>
          </Form>
        </Card>
      )}
      <Card>
        <Flex gap={12} wrap align="center" style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Number or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 260 }}
          />
          <Space style={{ marginLeft: "auto" }} size="large">
            <Statistic title="Principal" value={formatMoney(data.totals.principal)} />
            <Statistic title="Repaid" value={formatMoney(data.totals.repaid)} />
            <Statistic title="Outstanding" value={formatMoney(data.totals.outstanding)} />
          </Space>
        </Flex>
        <DataTable<LoanRow>
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

// ─── One loan ───────────────────────────────────────────────────────────────

export function LoanDetail({
  loan,
  canPay,
  canVoid,
}: {
  loan: LoanView;
  canPay: boolean;
  canVoid: boolean;
}) {
  const back = loan.kind === "INVESTMENT" ? "/loans/investments" : "/loans";
  return (
    <>
      <Link href={back} style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> {loan.kind === "INVESTMENT" ? "Received investments" : "Loans"}
      </Link>
      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" wrap gap={16}>
          <Space direction="vertical" size={2}>
            <Space>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {loan.number}
              </Typography.Title>
              <LoanStatusTag status={loan.status} />
            </Space>
            <Typography.Text>
              {KIND_LABEL[loan.kind]} · {loan.authority.name} · {formatDate(loan.date)}
            </Typography.Text>
          </Space>
          {canPay && loan.status === "ACTIVE" && (
            <Link href={`/loans/payments?loan=${loan.id}`}>
              <Button type="primary">
                {loan.kind === "GIVEN" ? "Record receipt" : "Record payment"}
              </Button>
            </Link>
          )}
        </Flex>
        <Descriptions
          style={{ marginTop: 16 }}
          size="small"
          column={{ xs: 1, md: 3 }}
          items={[
            { key: "p", label: "Principal", children: formatMoney(loan.principal) },
            { key: "r", label: "Repaid", children: formatMoney(loan.repaid) },
            {
              key: "o",
              label: "Outstanding",
              children: <strong>{formatMoney(loan.outstanding)}</strong>,
            },
            { key: "rate", label: "Yearly rate", children: `${loan.interestRate}%` },
            {
              key: "t",
              label: "Term",
              children: loan.termMonths ? `${loan.termMonths} months` : "-",
            },
            { key: "a", label: "Account", children: loan.moneyAccount },
            ...(loan.note ? [{ key: "n", label: "Note", children: loan.note }] : []),
            ...(loan.voidReason
              ? [{ key: "v", label: "Void reason", children: loan.voidReason }]
              : []),
          ]}
        />
      </Card>
      <Row gutter={16}>
        <Col xs={24} xl={12}>
          <Card title="Payments" style={{ marginBottom: 16 }}>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={loan.payments}
              columns={[
                { title: "Date", dataIndex: "date", render: (v: string) => formatDate(v) },
                { title: "Number", dataIndex: "number" },
                {
                  title: "Principal",
                  dataIndex: "principal",
                  align: "right",
                  render: (v: string) => formatMoney(v),
                },
                {
                  title: "Interest",
                  dataIndex: "interest",
                  align: "right",
                  render: (v: string) => formatMoney(v),
                },
                {
                  title: "Status",
                  key: "s",
                  render: (_, p) => <DocumentStatusTag status={p.status} reason={p.voidReason} />,
                },
                ...(canVoid
                  ? [
                      {
                        title: "",
                        key: "v",
                        render: (_: unknown, p: LoanView["payments"][number]) =>
                          p.status === "POSTED" && (
                            <VoidButton
                              what={p.number}
                              buttonProps={{ size: "small" }}
                              onVoid={(v) => voidLoanPaymentAction(p.id, v)}
                            />
                          ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Schedule (equal monthly installments)" style={{ marginBottom: 16 }}>
            {loan.schedule.length === 0 ? (
              <Typography.Text type="secondary">
                Set a term in months to see a schedule.
              </Typography.Text>
            ) : (
              <Table
                rowKey="no"
                size="small"
                pagination={{ pageSize: 12 }}
                dataSource={loan.schedule}
                columns={[
                  { title: "#", dataIndex: "no", width: 50 },
                  { title: "Month", dataIndex: "month" },
                  {
                    title: "Installment",
                    dataIndex: "installment",
                    align: "right",
                    render: (v: string) => formatMoney(v),
                  },
                  {
                    title: "Principal",
                    dataIndex: "principal",
                    align: "right",
                    render: (v: string) => formatMoney(v),
                  },
                  {
                    title: "Interest",
                    dataIndex: "interest",
                    align: "right",
                    render: (v: string) => formatMoney(v),
                  },
                  {
                    title: "Balance",
                    dataIndex: "balance",
                    align: "right",
                    render: (v: string) => formatMoney(v),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

// ─── Payments ───────────────────────────────────────────────────────────────

interface PaymentsPageProps {
  data: LoanPaymentList;
  params: ListParams;
  loans: (FieldOption & { kind: string; outstanding: string })[];
  accounts: FieldOption[];
  initialLoanId?: string;
  canCreate: boolean;
  canVoid: boolean;
  today: string;
}

export function LoanPaymentsPage({
  data,
  params,
  loans,
  accounts,
  initialLoanId,
  canCreate,
  canVoid,
  today,
}: PaymentsPageProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.q);
  const loanId = Form.useWatch("loanId", form) as string | undefined;
  const loan = loans.find((l) => l.value === loanId);

  function submit() {
    form
      .validateFields()
      .then((v: Record<string, unknown>) =>
        startTransition(async () => {
          const r = await createLoanPaymentAction({
            ...v,
            date: (v.date as Dayjs).format("YYYY-MM-DD"),
          });
          if (!applyActionResult(r, form, message)) return;
          if (!r.ok) return;
          message.success(`${r.data.number} saved`);
          form.resetFields();
          router.refresh();
        }),
      )
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  type Row = LoanPaymentList["rows"][number];
  return (
    <>
      <PageHeader
        title="Loan Payments"
        description="Installments paid on loans and investments received, and money received back on loans given."
      />
      {canCreate && (
        <Card style={{ marginBottom: 16 }}>
          <Form
            form={form}
            name="loanPayment"
            layout="vertical"
            requiredMark="optional"
            initialValues={{ date: dayjs(today), loanId: initialLoanId }}
          >
            <Row gutter={16}>
              <Col xs={24} xl={10}>
                <Form.Item
                  label="Loan"
                  name="loanId"
                  rules={[{ required: true, message: "Choose the loan" }]}
                  extra={
                    loan
                      ? `${loan.kind === "GIVEN" ? "Money comes in" : "Money goes out"} · ${formatMoney(loan.outstanding)} principal outstanding`
                      : undefined
                  }
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={loans}
                    notFoundContent="No active loans"
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={3}>
                <Form.Item label="Principal" name="principal">
                  <MoneyInput placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={3}>
                <Form.Item label="Interest" name="interest">
                  <MoneyInput placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label="Account"
                  name="moneyAccountId"
                  rules={[{ required: true, message: "Choose the account" }]}
                >
                  <Select showSearch optionFilterProp="label" options={accounts} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label="Date"
                  name="date"
                  rules={[{ required: true, message: "Required" }]}
                >
                  <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="Note" name="note">
                  <Input maxLength={500} />
                </Form.Item>
              </Col>
            </Row>
            <Flex justify="flex-end">
              <Button type="primary" loading={pending} onClick={submit}>
                Save
              </Button>
            </Flex>
          </Form>
        </Card>
      )}
      <Card>
        <Flex gap={12} wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Number, loan or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 260 }}
          />
          <DateRangeFilter from={params.from} to={params.to} />
        </Flex>
        <DataTable<Row>
          rows={data.rows}
          total={data.total}
          page={params.page}
          pageSize={params.pageSize}
          columns={[
            {
              title: "Date",
              dataIndex: "date",
              key: "d",
              width: 110,
              render: (v: string) => formatDate(v),
            },
            { title: "Number", dataIndex: "number", key: "n" },
            {
              title: "Loan",
              key: "l",
              render: (_, r) => <Link href={`/loans/${r.loanId}`}>{r.loanNumber}</Link>,
            },
            { title: "Kind", key: "k", render: (_, r) => KIND_LABEL[r.loanKind] },
            { title: "Name", dataIndex: "authority", key: "a" },
            {
              title: "Principal",
              dataIndex: "principal",
              key: "p",
              align: "right",
              render: (v: string) => formatMoney(v),
            },
            {
              title: "Interest",
              dataIndex: "interest",
              key: "i",
              align: "right",
              render: (v: string) => formatMoney(v),
            },
            { title: "Account", dataIndex: "moneyAccount", key: "acc" },
            {
              title: "Status",
              key: "s",
              render: (_, r) => <DocumentStatusTag status={r.status} reason={r.voidReason} />,
            },
            ...(canVoid
              ? [
                  {
                    title: "",
                    key: "v",
                    render: (_: unknown, r: Row) =>
                      r.status === "POSTED" && (
                        <VoidButton
                          what={r.number}
                          buttonProps={{ size: "small" }}
                          onVoid={(v) => voidLoanPaymentAction(r.id, v)}
                        />
                      ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </>
  );
}
