"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import { CopyOutlined, DeleteOutlined, MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { calcAirTicket } from "@/lib/calc/airTicket";
import { calcInvoiceTotals } from "@/lib/calc/invoiceTotals";
import { d } from "@/lib/calc/money";
import { formatMoney } from "@/lib/format";
import type { FieldOption } from "@/lib/masters";
import { PASSENGER_TYPE_OPTIONS } from "@/lib/schemas/invoices";
import type { AirPricingSettings } from "@/server/services/invoices/airInvoiceService";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { INVOICE_TYPE_INFO } from "@/lib/invoiceTypes";
import { createInvoiceAction, updateInvoiceAction } from "../invoiceActions";

interface TicketForm {
  ticketNo?: string;
  pnr?: string | null;
  gdsPnr?: string | null;
  gds?: string | null;
  airlineId?: string;
  vendorId?: string | null;
  passengerName?: string;
  passengerType?: string;
  passportNo?: string | null;
  route?: string;
  journeyDate?: Dayjs | null;
  returnDate?: Dayjs | null;
  cabinClass?: string | null;
  baseFare?: string | null;
  taxes?: { code?: string; amount?: string | null }[];
  commissionPercent?: string | null;
  /** Non commission tickets only. */
  purchasePrice?: string | null;
  clientPrice?: string | null;
}

interface InvoiceForm {
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
  tickets?: TicketForm[];
}

export interface AirInvoiceFormValues {
  clientId: string;
  date: string;
  dueDate?: string | null;
  salesmanId?: string | null;
  agentId?: string | null;
  agentCommission?: string;
  discount?: string;
  serviceCharge?: string;
  vat?: string;
  note?: string | null;
  tickets: (Omit<TicketForm, "journeyDate" | "returnDate"> & {
    journeyDate: string;
    returnDate?: string | null;
  })[];
}

interface Props {
  /** AIR = commission & AIT worked out; NON_COMMISSION = purchase price entered directly. */
  type?: "AIR" | "NON_COMMISSION";
  mode: "create" | "edit";
  invoiceId?: string;
  invoiceNumber?: string;
  isDraft?: boolean;
  initial?: AirInvoiceFormValues;
  today: string;
  airlines: FieldOption[];
  employees: FieldOption[];
  pricing: AirPricingSettings;
}

const emptyTicket = (): TicketForm => ({
  passengerType: "ADT",
  taxes: [],
  commissionPercent: null,
});

function toForm(v: AirInvoiceFormValues): InvoiceForm {
  return {
    ...v,
    date: dayjs(v.date),
    dueDate: v.dueDate ? dayjs(v.dueDate) : null,
    tickets: v.tickets.map((t) => ({
      ...t,
      journeyDate: dayjs(t.journeyDate),
      returnDate: t.returnDate ? dayjs(t.returnDate) : null,
    })),
  };
}

const iso = (v?: Dayjs | null) => (v ? v.format("YYYY-MM-DD") : null);

function safeCalc<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function AirInvoiceForm(props: Props) {
  const { mode, invoiceId, invoiceNumber, isDraft, initial, today, airlines, employees, pricing } =
    props;
  const type = props.type ?? "AIR";
  const nonCommission = type === "NON_COMMISSION";
  const basePath = INVOICE_TYPE_INFO[type].path;
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<InvoiceForm>();
  const [pending, startTransition] = useTransition();
  const values = Form.useWatch([], form) as InvoiceForm | undefined;

  const priced = useMemo(
    () =>
      (values?.tickets ?? []).map((t) =>
        safeCalc(() => {
          if (nonCommission) {
            const taxTotal = (t?.taxes ?? []).reduce((a, x) => a.plus(d(x?.amount)), d(0));
            const purchasePrice = d(t?.purchasePrice);
            return {
              taxTotal,
              totalFare: d(t?.baseFare).plus(taxTotal),
              commissionAmount: d(0),
              aitAmount: d(0),
              purchasePrice,
              profit: d(t?.clientPrice).minus(purchasePrice),
            };
          }
          return calcAirTicket({
            baseFare: t?.baseFare || 0,
            taxes: (t?.taxes ?? []).map((x) => ({ code: x?.code ?? "", amount: x?.amount || 0 })),
            commissionPercent: t?.commissionPercent || 0,
            commissionBase:
              (t?.airlineId && pricing.airlines[t.airlineId]?.commissionBase) ||
              pricing.commissionBase,
            aitRatePercent: pricing.aitRatePercent,
            aitBase: pricing.aitBase,
            clientPrice: t?.clientPrice || 0,
          });
        }),
      ),
    [values?.tickets, pricing, nonCommission],
  );

  const totals = useMemo(
    () =>
      safeCalc(() =>
        calcInvoiceTotals({
          lines: (values?.tickets ?? []).map((t, i) => ({
            clientPrice: t?.clientPrice || 0,
            purchasePrice: priced[i]?.purchasePrice ?? 0,
          })),
          discount: values?.discount || 0,
          serviceCharge: values?.serviceCharge || 0,
          vat: values?.vat || 0,
          agentCommission: values?.agentCommission || 0,
        }),
      ),
    [values, priced],
  );

  /** Fill commission % from the airline default the first time an airline is picked. */
  function onValuesChange(changed: Partial<InvoiceForm>) {
    const changedTickets = changed.tickets;
    if (!changedTickets || nonCommission) return;
    changedTickets.forEach((t, i) => {
      if (!t?.airlineId) return;
      const current = form.getFieldValue(["tickets", i, "commissionPercent"]);
      const preset = pricing.airlines[t.airlineId]?.commissionPercent;
      if ((current === null || current === undefined || current === "") && preset) {
        form.setFieldValue(["tickets", i, "commissionPercent"], preset);
      }
    });
  }

  function submit(post: boolean) {
    form
      .validateFields()
      .then((v) => {
        const payload = {
          ...v,
          date: iso(v.date),
          dueDate: iso(v.dueDate),
          tickets: (v.tickets ?? []).map((t) => ({
            ...t,
            journeyDate: iso(t.journeyDate),
            returnDate: iso(t.returnDate),
          })),
          post,
        };
        startTransition(async () => {
          const result =
            mode === "create"
              ? await createInvoiceAction(type, payload)
              : await updateInvoiceAction(type, invoiceId!, payload);
          if (!applyActionResult(result, form, message)) return;
          const id =
            mode === "create" && result.ok ? (result.data as { id: string }).id : invoiceId!;
          message.success(post ? "Invoice saved and posted" : "Invoice saved as draft");
          router.push(`${basePath}/${id}`);
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  const money = (v: { toFixed(n: number): string } | null | undefined) =>
    v ? formatMoney(v.toFixed(2)) : "-";

  return (
    <>
      <PageHeader
        title={
          mode === "create"
            ? nonCommission
              ? "New Non Commission Invoice"
              : "New Air Ticket Invoice"
            : `Edit ${invoiceNumber}`
        }
        description={
          mode === "edit" && !isDraft
            ? "This invoice is posted. Saving reverses its old ledger entry and posts the new figures."
            : nonCommission
              ? "Tickets bought at a net fare: enter what you paid and what the client pays."
              : "Commission and AIT are worked out from App Config and the airline's settings."
        }
      />
      <Form<InvoiceForm>
        form={form}
        name="airInvoice"
        layout="vertical"
        requiredMark="optional"
        initialValues={initial ? toForm(initial) : { date: dayjs(today), tickets: [emptyTicket()] }}
        onValuesChange={onValuesChange}
        scrollToFirstError
      >
        <Card title="Invoice" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Client"
                name="clientId"
                rules={[{ required: true, message: "Choose a client" }]}
              >
                <PartySelect party="clients" id="airInvoice_clientId" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item
                label="Invoice date"
                name="date"
                rules={[{ required: true, message: "Choose a date" }]}
              >
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Due date" name="dueDate">
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item label="Sold by" name="salesmanId">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={employees}
                  placeholder="Employee"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item label="Referred by agent" name="agentId">
                <PartySelect party="agents" id="airInvoice_agentId" placeholder="Optional" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Agent commission" name="agentCommission">
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Form.List name="tickets">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => {
                const p = priced[index];
                return (
                  <Card
                    key={field.key}
                    size="small"
                    style={{ marginBottom: 16 }}
                    title={`Ticket ${index + 1}`}
                    extra={
                      <Space>
                        <Tooltip title="Copy this ticket (same route and fares)">
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => {
                              const t = form.getFieldValue(["tickets", index]) as TicketForm;
                              add(
                                {
                                  ...t,
                                  ticketNo: undefined,
                                  passengerName: undefined,
                                  passportNo: undefined,
                                },
                                index + 1,
                              );
                            }}
                          />
                        </Tooltip>
                        {fields.length > 1 && (
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(field.name)}
                          >
                            Remove
                          </Button>
                        )}
                      </Space>
                    }
                  >
                    <Row gutter={12}>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item
                          label="Ticket no."
                          name={[field.name, "ticketNo"]}
                          rules={[{ required: true, message: "Required" }]}
                        >
                          <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={3}>
                        <Form.Item label="PNR" name={[field.name, "pnr"]}>
                          <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12} xl={7}>
                        <Form.Item
                          label="Airline"
                          name={[field.name, "airlineId"]}
                          rules={[{ required: true, message: "Choose the airline" }]}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            options={airlines}
                            placeholder="Airline"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12} xl={10}>
                        <Form.Item
                          label="Vendor"
                          name={[field.name, "vendorId"]}
                          rules={[{ required: true, message: "Choose the vendor" }]}
                        >
                          <PartySelect
                            party="vendors"
                            id={`airInvoice_tickets_${index}_vendorId`}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12} xl={8}>
                        <Form.Item
                          label="Passenger name"
                          name={[field.name, "passengerName"]}
                          rules={[{ required: true, message: "Required" }]}
                        >
                          <Input maxLength={120} style={{ textTransform: "uppercase" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={3}>
                        <Form.Item label="Type" name={[field.name, "passengerType"]}>
                          <Select options={[...PASSENGER_TYPE_OPTIONS]} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item label="Passport no." name={[field.name, "passportNo"]}>
                          <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12} xl={5}>
                        <Form.Item
                          label="Route"
                          name={[field.name, "route"]}
                          rules={[
                            { required: true, message: "Required" },
                            {
                              pattern: /^[A-Za-z]{3}(-[A-Za-z]{3})+$/,
                              message: "e.g. DAC-DXB-DAC",
                            },
                          ]}
                        >
                          <Input placeholder="DAC-DXB-DAC" style={{ textTransform: "uppercase" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item label="Class" name={[field.name, "cabinClass"]}>
                          <Input maxLength={20} placeholder="Economy" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item
                          label="Journey date"
                          name={[field.name, "journeyDate"]}
                          rules={[{ required: true, message: "Required" }]}
                        >
                          <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item label="Return date" name={[field.name, "returnDate"]}>
                          <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item label="GDS" name={[field.name, "gds"]}>
                          <Input maxLength={30} placeholder="Sabre, Galileo, ..." />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item label="GDS PNR" name={[field.name, "gdsPnr"]}>
                          <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider style={{ margin: "4px 0 12px" }} />
                    <Row gutter={12}>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item
                          label="Base fare"
                          name={[field.name, "baseFare"]}
                          rules={nonCommission ? [] : [{ required: true, message: "Required" }]}
                        >
                          <MoneyInput />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12} xl={8}>
                        <Form.Item label="Taxes">
                          <Form.List name={[field.name, "taxes"]}>
                            {(taxFields, tax) => (
                              <Flex wrap gap={6}>
                                {taxFields.map((tf) => (
                                  <Space.Compact key={tf.key}>
                                    <Form.Item
                                      name={[tf.name, "code"]}
                                      noStyle
                                      rules={[{ required: true }]}
                                    >
                                      <Input
                                        placeholder="Code"
                                        maxLength={4}
                                        style={{ width: 64, textTransform: "uppercase" }}
                                      />
                                    </Form.Item>
                                    <Form.Item
                                      name={[tf.name, "amount"]}
                                      noStyle
                                      rules={[{ required: true }]}
                                    >
                                      <MoneyInput style={{ width: 110 }} placeholder="0.00" />
                                    </Form.Item>
                                    <Button
                                      icon={<MinusCircleOutlined />}
                                      onClick={() => tax.remove(tf.name)}
                                    />
                                  </Space.Compact>
                                ))}
                                <Button
                                  size="middle"
                                  icon={<PlusOutlined />}
                                  onClick={() => tax.add({ code: "", amount: null })}
                                >
                                  Tax
                                </Button>
                              </Flex>
                            )}
                          </Form.List>
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        {nonCommission ? (
                          <Form.Item
                            label="Purchase price"
                            name={[field.name, "purchasePrice"]}
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <MoneyInput />
                          </Form.Item>
                        ) : (
                          <Form.Item
                            label="Commission %"
                            name={[field.name, "commissionPercent"]}
                            tooltip="Filled from the airline's default; change it if this fare earns a different rate."
                          >
                            <MoneyInput precision={4} max="100" suffix="%" />
                          </Form.Item>
                        )}
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Form.Item
                          label="Client price"
                          name={[field.name, "clientPrice"]}
                          rules={[{ required: true, message: "Required" }]}
                        >
                          <MoneyInput />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Descriptions
                      size="small"
                      column={{ xs: 2, md: 3, xl: 6 }}
                      items={[
                        { key: "total", label: "Total fare", children: money(p?.totalFare) },
                        ...(nonCommission
                          ? []
                          : [
                              {
                                key: "comm",
                                label: "Commission",
                                children: money(p?.commissionAmount),
                              },
                              { key: "ait", label: "AIT", children: money(p?.aitAmount) },
                            ]),
                        {
                          key: "cost",
                          label: "Purchase price",
                          children: <strong>{money(p?.purchasePrice)}</strong>,
                        },
                        {
                          key: "profit",
                          label: "Profit",
                          children: (
                            <Typography.Text
                              type={p && p.profit.isNegative() ? "danger" : "success"}
                              strong
                            >
                              {money(p?.profit)}
                            </Typography.Text>
                          ),
                        },
                      ]}
                    />
                  </Card>
                );
              })}
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                style={{ marginBottom: 16 }}
                onClick={() => add(emptyTicket())}
                disabled={fields.length >= 50}
              >
                Add ticket
              </Button>
            </>
          )}
        </Form.List>

        <Card title="Totals" style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item label="Discount" name="discount">
                    <MoneyInput placeholder="0.00" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Service charge" name="serviceCharge">
                    <MoneyInput placeholder="0.00" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="VAT" name="vat">
                    <MoneyInput placeholder="0.00" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Note" name="note">
                    <Input.TextArea rows={2} maxLength={1000} />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            <Col xs={24} lg={12}>
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "sub",
                    label: "Tickets (client price)",
                    children: money(totals?.subtotal),
                  },
                  {
                    key: "net",
                    label: "Client pays",
                    children: <strong>{money(totals?.netTotal)}</strong>,
                  },
                  { key: "cost", label: "Payable to vendors", children: money(totals?.totalCost) },
                  {
                    key: "profit",
                    label: "Profit",
                    children: (
                      <Typography.Text
                        strong
                        type={totals && d(totals.profit).isNegative() ? "danger" : "success"}
                      >
                        {money(totals?.profit)}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            </Col>
          </Row>
        </Card>

        <Flex gap={8} justify="flex-end" style={{ marginBottom: 24 }}>
          <Link href={invoiceId ? `${basePath}/${invoiceId}` : basePath}>
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
