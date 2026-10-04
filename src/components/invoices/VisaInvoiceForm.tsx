"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  AutoComplete,
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
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { calcInvoiceTotals } from "@/lib/calc/invoiceTotals";
import { d } from "@/lib/calc/money";
import { formatMoney } from "@/lib/format";
import type { FieldOption } from "@/lib/masters";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { createInvoiceAction, updateInvoiceAction } from "@/app/(app)/invoices/invoiceActions";
import { InvoiceHeaderCard } from "./InvoiceHeaderCard";
import { InvoiceTotalsCard } from "./InvoiceTotalsCard";
import { VISA_STATUS_LABEL } from "./visaStatus";

interface Line {
  id?: string | null;
  country?: string;
  visaTypeId?: string | null;
  passengerName?: string;
  passportNo?: string | null;
  vendorId?: string | null;
  clientPrice?: string | null;
  purchasePrice?: string | null;
  expectedDate?: Dayjs | null;
  note?: string | null;
  /** Read only, for display when editing. */
  status?: string;
}

interface FormValues {
  clientId?: string | null;
  date?: Dayjs;
  dueDate?: Dayjs | null;
  salesmanId?: string | null;
  agentId?: string | null;
  agentCommission?: string | null;
  discount?: string | null;
  serviceCharge?: string | null;
  vat?: string | null;
  note?: string | null;
  lines?: Line[];
}

export interface VisaFormInitial extends Omit<FormValues, "date" | "dueDate" | "lines"> {
  date: string;
  dueDate?: string | null;
  lines: (Omit<Line, "expectedDate"> & { expectedDate?: string | null })[];
}

interface Props {
  mode: "create" | "edit";
  invoiceId?: string;
  invoiceNumber?: string;
  isDraft?: boolean;
  initial?: VisaFormInitial;
  today: string;
  employees: FieldOption[];
  visaTypes: FieldOption[];
  countries: FieldOption[];
}

const iso = (v?: Dayjs | null) => (v ? v.format("YYYY-MM-DD") : null);

export function VisaInvoiceForm({
  mode,
  invoiceId,
  invoiceNumber,
  isDraft,
  initial,
  today,
  employees,
  visaTypes,
  countries,
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [pending, startTransition] = useTransition();
  const values = Form.useWatch([], form) as FormValues | undefined;

  const totals = useMemo(() => {
    try {
      return calcInvoiceTotals({
        lines: (values?.lines ?? []).map((l) => ({
          clientPrice: l?.clientPrice || 0,
          purchasePrice: l?.purchasePrice || 0,
        })),
        discount: values?.discount || 0,
        serviceCharge: values?.serviceCharge || 0,
        vat: values?.vat || 0,
        agentCommission: values?.agentCommission || 0,
      });
    } catch {
      return null;
    }
  }, [values]);

  function submit(post: boolean) {
    form
      .validateFields()
      .then((v) => {
        const payload = {
          ...v,
          date: iso(v.date),
          dueDate: iso(v.dueDate),
          lines: (v.lines ?? []).map((l) => {
            const { status: _status, ...rest } = l;
            void _status;
            return { ...rest, expectedDate: iso(l.expectedDate) };
          }),
          post,
        };
        startTransition(async () => {
          const result =
            mode === "create"
              ? await createInvoiceAction("VISA", payload)
              : await updateInvoiceAction("VISA", invoiceId!, payload);
          if (!applyActionResult(result, form, message)) return;
          const id =
            mode === "create" && result.ok ? (result.data as { id: string }).id : invoiceId!;
          message.success(post ? "Invoice saved and posted" : "Invoice saved as draft");
          router.push(`/invoices/visa/${id}`);
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  const countryOptions = countries.map((c) => ({ value: c.label }));

  return (
    <>
      <PageHeader
        title={mode === "create" ? "New Visa Invoice" : `Edit ${invoiceNumber}`}
        description={
          mode === "edit" && !isDraft
            ? "This invoice is posted. Saving reverses its old ledger entry and posts the new figures. Each passenger keeps their processing status."
            : "One line per passenger. Track each visa on the Visa Process board."
        }
      />
      <Form<FormValues>
        form={form}
        name="visaInvoice"
        layout="vertical"
        requiredMark="optional"
        scrollToFirstError
        initialValues={
          initial
            ? {
                ...initial,
                date: dayjs(initial.date),
                dueDate: initial.dueDate ? dayjs(initial.dueDate) : null,
                lines: initial.lines.map((l) => ({
                  ...l,
                  expectedDate: l.expectedDate ? dayjs(l.expectedDate) : null,
                })),
              }
            : { date: dayjs(today), lines: [{}] }
        }
      >
        <InvoiceHeaderCard formName="visaInvoice" employees={employees} />

        <Card title="Passengers" style={{ marginBottom: 16 }}>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => {
                  const line = values?.lines?.[index];
                  let profit: ReturnType<typeof d> | null = null;
                  try {
                    profit = d(line?.clientPrice).minus(d(line?.purchasePrice));
                  } catch {
                    profit = null;
                  }
                  return (
                    <div
                      key={field.key}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        paddingBottom: 8,
                        marginBottom: 12,
                      }}
                    >
                      <Form.Item name={[field.name, "id"]} hidden>
                        <Input />
                      </Form.Item>
                      <Row gutter={10} align="bottom" className="line-row">
                        <Col xs={24} md={8} xl={5}>
                          <Form.Item
                            label="Passenger name"
                            name={[field.name, "passengerName"]}
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <Input maxLength={120} style={{ textTransform: "uppercase" }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4} xl={3}>
                          <Form.Item label="Passport no." name={[field.name, "passportNo"]}>
                            <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6} xl={3}>
                          <Form.Item
                            label="Country"
                            name={[field.name, "country"]}
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <AutoComplete
                              options={countryOptions}
                              filterOption={(input, o) =>
                                String(o?.value).toLowerCase().includes(input.toLowerCase())
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6} xl={3}>
                          <Form.Item label="Visa type" name={[field.name, "visaTypeId"]}>
                            <Select allowClear options={visaTypes} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8} xl={4}>
                          <Form.Item
                            label="Vendor"
                            name={[field.name, "vendorId"]}
                            rules={[{ required: true, message: "Choose the vendor" }]}
                          >
                            <PartySelect party="vendors" placeholder="Embassy agent / processor" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4} xl={2}>
                          <Form.Item
                            label="Client price"
                            name={[field.name, "clientPrice"]}
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <MoneyInput />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4} xl={2}>
                          <Form.Item
                            label="Cost"
                            name={[field.name, "purchasePrice"]}
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <MoneyInput />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4} xl={1}>
                          <Form.Item label=" ">
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              aria-label={`Remove passenger ${index + 1}`}
                              disabled={fields.length === 1}
                              onClick={() => remove(field.name)}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6} xl={4}>
                          <Form.Item label="Expected by" name={[field.name, "expectedDate"]}>
                            <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12} xl={8}>
                          <Form.Item label="Note" name={[field.name, "note"]}>
                            <Input maxLength={300} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Space size="large" style={{ fontSize: 12 }}>
                        <Typography.Text type={profit?.isNegative() ? "danger" : "success"}>
                          Profit: {profit ? formatMoney(profit.toFixed(2)) : "-"}
                        </Typography.Text>
                        {line?.status && <Tag>{VISA_STATUS_LABEL[line.status] ?? line.status}</Tag>}
                      </Space>
                    </div>
                  );
                })}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({})}>
                  Add passenger
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        <InvoiceTotalsCard totals={totals} />

        <Flex gap={8} justify="flex-end" style={{ marginBottom: 24 }}>
          <Link href={invoiceId ? `/invoices/visa/${invoiceId}` : "/invoices/visa"}>
            <Button>Cancel</Button>
          </Link>
          {(mode === "create" || isDraft) && (
            <Button loading={pending} onClick={() => submit(false)}>
              Save as draft
            </Button>
          )}
          <Button type="primary" loading={pending} onClick={() => submit(true)}>
            {mode === "edit" && !isDraft ? "Save changes" : "Save & post"}
          </Button>
        </Flex>
      </Form>
    </>
  );
}
