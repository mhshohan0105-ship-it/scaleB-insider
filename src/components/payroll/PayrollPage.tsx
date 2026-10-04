"use client";

import { useMemo, useState, useTransition } from "react";
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
  Row,
  Select,
  Space,
  Statistic,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, FilePdfOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { calcPayroll } from "@/lib/calc/payroll";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { FieldOption } from "@/lib/masters";
import type { PayrollList } from "@/server/services/payroll/payrollService";
import { DataTable } from "@/components/DataTable";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import {
  createPayrollAction,
  payrollDefaultsAction,
  voidPayrollAction,
} from "@/app/(app)/vouchers/actions";

interface Props {
  data: PayrollList;
  params: ListParams;
  month?: string;
  employees: FieldOption[];
  accounts: FieldOption[];
  canCreate: boolean;
  canVoid: boolean;
  today: string;
}

interface Values {
  employeeId?: string;
  month?: Dayjs;
  date?: Dayjs;
  basic?: string;
  allowances?: { name?: string; amount?: string }[];
  deductions?: { name?: string; amount?: string }[];
  advanceAdjusted?: string;
  moneyAccountId?: string;
  note?: string;
}

function PayLines({ name, label }: { name: "allowances" | "deductions"; label: string }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          <Typography.Text strong>{label}</Typography.Text>
          {fields.map((f, i) => (
            <Row key={f.key} gutter={8} className="line-row" style={{ marginTop: 8 }}>
              <Col span={13}>
                <Form.Item
                  name={[f.name, "name"]}
                  rules={[{ required: true, message: "Name it" }]}
                  noStyle
                >
                  <Input placeholder="e.g. House rent" aria-label={`${label} ${i + 1} name`} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={[f.name, "amount"]}
                  rules={[{ required: true, message: "Amount" }]}
                  noStyle
                >
                  <MoneyInput aria-label={`${label} ${i + 1} amount`} />
                </Form.Item>
              </Col>
              <Col span={3}>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`Remove ${label} ${i + 1}`}
                  onClick={() => remove(f.name)}
                />
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => add({})}
            style={{ marginTop: 8 }}
          >
            Add
          </Button>
        </>
      )}
    </Form.List>
  );
}

export function PayrollPage({
  data,
  params,
  month,
  employees,
  accounts,
  canCreate,
  canVoid,
  today,
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [form] = Form.useForm<Values>();
  const [pending, startTransition] = useTransition();
  const [outstanding, setOutstanding] = useState("0.00");
  const values = Form.useWatch([], form) as Values | undefined;

  const result = useMemo(() => {
    try {
      return calcPayroll({
        basic: values?.basic || 0,
        allowances: (values?.allowances ?? []).map((a) => ({ amount: a?.amount || 0 })),
        deductions: (values?.deductions ?? []).map((a) => ({ amount: a?.amount || 0 })),
        advanceAdjusted: values?.advanceAdjusted || 0,
        advanceOutstanding: outstanding,
      });
    } catch {
      return null;
    }
  }, [values, outstanding]);

  async function pickEmployee(id: string) {
    const r = await payrollDefaultsAction(id);
    if (!r.ok || !r.data) return;
    setOutstanding(r.data.advanceOutstanding);
    form.setFieldsValue({ basic: r.data.salary, advanceAdjusted: "0" });
  }

  function submit() {
    form
      .validateFields()
      .then((v) =>
        startTransition(async () => {
          const r = await createPayrollAction({
            ...v,
            month: v.month?.format("YYYY-MM"),
            date: v.date?.format("YYYY-MM-DD"),
          });
          if (!applyActionResult(r, form, message)) return;
          if (!r.ok) return;
          message.success(`${r.data.number} saved`);
          form.resetFields();
          setOutstanding("0.00");
          router.refresh();
        }),
      )
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  type Row = PayrollList["rows"][number];
  const m = (v: string) => formatMoney(v);
  const columns: TableColumnsType<Row> = [
    { title: "Month", dataIndex: "month", key: "month", width: 90 },
    { title: "Number", dataIndex: "number", key: "n" },
    { title: "Employee", dataIndex: "employee", key: "e" },
    { title: "Basic", dataIndex: "basic", key: "b", align: "right", render: m },
    { title: "Allowances", dataIndex: "allowanceTotal", key: "a", align: "right", render: m },
    { title: "Deductions", dataIndex: "deductionTotal", key: "d", align: "right", render: m },
    { title: "Advance", dataIndex: "advanceAdjusted", key: "adv", align: "right", render: m },
    {
      title: "Net paid",
      dataIndex: "netPaid",
      key: "net",
      align: "right",
      render: (v: string) => <strong>{m(v)}</strong>,
    },
    { title: "Paid on", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    {
      title: "Status",
      key: "s",
      render: (_, r) => <DocumentStatusTag status={r.status} reason={r.voidReason} />,
    },
    {
      title: "",
      key: "act",
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<FilePdfOutlined />}
            href={`/api/pdf/payslip/${r.id}`}
            target="_blank"
          >
            Payslip
          </Button>
          {canVoid && r.status === "POSTED" && (
            <VoidButton
              what={r.number}
              buttonProps={{ size: "small" }}
              onVoid={(v) => voidPayrollAction(r.id, v)}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Monthly salary per employee. Outstanding advances can be recovered from the salary."
      />
      {canCreate && (
        <Card style={{ marginBottom: 16 }}>
          <Form<Values>
            form={form}
            name="payroll"
            layout="vertical"
            requiredMark="optional"
            initialValues={{
              month: dayjs(today).startOf("month"),
              date: dayjs(today),
              allowances: [],
              deductions: [],
            }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="Employee"
                  name="employeeId"
                  rules={[{ required: true, message: "Choose the employee" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={employees}
                    onChange={pickEmployee}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={3}>
                <Form.Item
                  label="Month"
                  name="month"
                  rules={[{ required: true, message: "Required" }]}
                >
                  <DatePicker
                    picker="month"
                    format="MMM YYYY"
                    style={{ width: "100%" }}
                    allowClear={false}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={3}>
                <Form.Item
                  label="Basic salary"
                  name="basic"
                  rules={[{ required: true, message: "Required" }]}
                >
                  <MoneyInput />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label="Advance adjusted"
                  name="advanceAdjusted"
                  extra={`Outstanding advance: ${formatMoney(outstanding)}`}
                >
                  <MoneyInput placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label="Paid from"
                  name="moneyAccountId"
                  rules={[{ required: true, message: "Choose the account" }]}
                >
                  <Select showSearch optionFilterProp="label" options={accounts} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6} xl={4}>
                <Form.Item
                  label="Paid on"
                  name="date"
                  rules={[{ required: true, message: "Required" }]}
                >
                  <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={8}>
                <PayLines name="allowances" label="Allowances" />
              </Col>
              <Col xs={24} md={12} xl={8}>
                <PayLines name="deductions" label="Deductions" />
              </Col>
              <Col xs={24} xl={8}>
                <Form.Item label="Note" name="note">
                  <Input maxLength={500} />
                </Form.Item>
              </Col>
            </Row>
            <Flex justify="space-between" align="center" wrap gap={16} style={{ marginTop: 16 }}>
              <Space size="large">
                <Statistic
                  title="Salary (expense)"
                  value={result ? formatMoney(result.salaryExpense.toFixed(2)) : "-"}
                />
                <Statistic
                  title="Net paid"
                  value={result ? formatMoney(result.netPaid.toFixed(2)) : "-"}
                />
                {result?.errors[0] && (
                  <Typography.Text type="danger">{result.errors[0]}</Typography.Text>
                )}
              </Space>
              <Button type="primary" loading={pending} onClick={submit}>
                Pay salary
              </Button>
            </Flex>
          </Form>
        </Card>
      )}
      <Card>
        <Flex gap={12} wrap align="center" style={{ marginBottom: 12 }}>
          <DatePicker
            picker="month"
            format="MMM YYYY"
            placeholder="All months"
            value={month ? dayjs(`${month}-01`) : null}
            onChange={(d) => setParams({ month: d ? d.format("YYYY-MM") : "" })}
            aria-label="Month"
          />
          <Space style={{ marginLeft: "auto" }} size="large">
            <Statistic title="Salaries" value={formatMoney(data.totals.gross)} />
            <Statistic title="Advance recovered" value={formatMoney(data.totals.advance)} />
            <Statistic title="Net paid" value={formatMoney(data.totals.net)} />
          </Space>
        </Flex>
        <DataTable<Row>
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
