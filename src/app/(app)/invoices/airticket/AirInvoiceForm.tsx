"use client";

import { useMemo, useState, useTransition } from "react";
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
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
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
import { THEME } from "@/components/Providers";
import { applyActionResult } from "@/components/formResult";
import { ClientField } from "@/components/invoices/ClientField";
import { INVOICE_TYPE_INFO } from "@/lib/invoiceTypes";
import { createInvoiceAction, updateInvoiceAction } from "../invoiceActions";

interface SegmentForm {
  from?: string;
  to?: string;
  airline?: string | null;
  flightNo?: string | null;
  date?: Dayjs | null;
  departs?: string | null;
  arrives?: string | null;
}

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
  issueDate?: Dayjs | null;
  cabinClass?: string | null;
  baseFare?: string | null;
  taxes?: { code?: string; amount?: string | null }[];
  commissionPercent?: string | null;
  /** Non commission tickets only. */
  purchasePrice?: string | null;
  clientPrice?: string | null;
  extraFee?: string | null;
  segments?: SegmentForm[];
}

interface PaymentForm {
  moneyAccountId?: string;
  paymentMethod?: string;
  amount?: string | null;
  date?: Dayjs | null;
  reference?: string | null;
}

interface InvoiceForm {
  clientId?: string | null;
  newClient?: Record<string, unknown>;
  date?: Dayjs;
  dueDate?: Dayjs | null;
  salesmanId?: string | null;
  agentId?: string | null;
  agentCommission?: string | null;
  discount?: string | null;
  serviceCharge?: string | null;
  vat?: string | null;
  note?: string | null;
  reference?: string | null;
  showPrevDue?: boolean;
  showDiscount?: boolean;
  showExtraFee?: boolean;
  tickets?: TicketForm[];
  payment?: PaymentForm;
}

type IsoSegment = Omit<SegmentForm, "date"> & { date?: string | null };

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
  reference?: string | null;
  showPrevDue?: boolean;
  showDiscount?: boolean;
  showExtraFee?: boolean;
  tickets: (Omit<TicketForm, "journeyDate" | "returnDate" | "issueDate" | "segments"> & {
    journeyDate: string;
    returnDate?: string | null;
    issueDate?: string | null;
    segments?: IsoSegment[];
  })[];
}

export interface AccountOption {
  value: string;
  label: string;
  kind: string;
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
  /** Accounts money can go into; empty when the user may not take payments. */
  accounts?: AccountOption[];
}

const METHOD_BY_KIND: Record<string, string> = {
  CASH: "CASH",
  BANK: "BANK",
  MOBILE_BANKING: "MOBILE",
  CREDIT_CARD: "CARD",
};

const emptyTicket = (today: string): TicketForm => ({
  passengerType: "ADT",
  taxes: [],
  segments: [],
  commissionPercent: null,
  issueDate: dayjs(today),
});

const toDay = (v?: string | null) => (v ? dayjs(v) : null);

function toForm(v: AirInvoiceFormValues): InvoiceForm {
  return {
    ...v,
    date: dayjs(v.date),
    dueDate: toDay(v.dueDate),
    tickets: v.tickets.map((t) => ({
      ...t,
      journeyDate: dayjs(t.journeyDate),
      returnDate: toDay(t.returnDate),
      issueDate: toDay(t.issueDate),
      segments: (t.segments ?? []).map((s) => ({ ...s, date: toDay(s.date) })),
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

/** Label / value row of the money panels. */
function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "success" | "danger";
}) {
  return (
    <Flex justify="space-between" style={{ fontSize: 14, fontWeight: strong ? 600 : 400 }}>
      <span>{label}</span>
      <Typography.Text strong={strong} type={tone} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography.Text>
    </Flex>
  );
}

export function AirInvoiceForm(props: Props) {
  const { mode, invoiceId, invoiceNumber, isDraft, initial, today, airlines, employees, pricing } =
    props;
  const accounts = props.accounts ?? [];
  const type = props.type ?? "AIR";
  const nonCommission = type === "NON_COMMISSION";
  const basePath = INVOICE_TYPE_INFO[type].path;
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<InvoiceForm>();
  const [pending, startTransition] = useTransition();
  const [receive, setReceive] = useState(false);
  const values = Form.useWatch([], form) as InvoiceForm | undefined;
  const canReceive = mode === "create" && accounts.length > 0;

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

  const received = receive ? d(values?.payment?.amount) : d(0);
  const due = totals ? d(totals.netTotal.toFixed(2)).minus(received) : null;

  /** Fill commission % from the airline default the first time an airline is picked. */
  function onValuesChange(changed: Partial<InvoiceForm>) {
    if (changed.payment?.moneyAccountId) {
      const kind = accounts.find((a) => a.value === changed.payment!.moneyAccountId)?.kind;
      if (kind && METHOD_BY_KIND[kind])
        form.setFieldValue(["payment", "paymentMethod"], METHOD_BY_KIND[kind]);
    }
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

  function submit(post: boolean, preview = false) {
    // Opened now (inside the click) so the browser does not block it as a pop-up.
    const pdfWindow = preview ? window.open("about:blank", "_blank") : null;
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
            issueDate: iso(t.issueDate),
            segments: (t.segments ?? []).map((s) => ({ ...s, date: iso(s.date) })),
          })),
          payment:
            canReceive && receive && post && v.payment
              ? { ...v.payment, date: iso(v.payment.date) }
              : null,
          post,
        };
        startTransition(async () => {
          const result =
            mode === "create"
              ? await createInvoiceAction(type, payload)
              : await updateInvoiceAction(type, invoiceId!, payload);
          if (!applyActionResult(result, form, message)) {
            pdfWindow?.close();
            return;
          }
          const id =
            mode === "create" && result.ok ? (result.data as { id: string }).id : invoiceId!;
          message.success(post ? "Invoice saved and posted" : "Invoice saved as draft");
          if (pdfWindow) pdfWindow.location.href = `/api/pdf/invoice/${id}`;
          router.push(`${basePath}/${id}`);
          router.refresh();
        });
      })
      .catch(() => {
        pdfWindow?.close();
        message.error("Please fix the highlighted fields");
      });
  }

  const money = (v: { toFixed(n: number): string } | null | undefined) =>
    v ? formatMoney(v.toFixed(2)) : "-";

  const summaryRows = (values?.tickets ?? []).map((t, i) => ({
    key: i,
    ticket: t?.ticketNo || `Ticket ${i + 1}`,
    passenger: t?.passengerName ?? "",
    sales: t?.clientPrice ? formatMoney(d(t.clientPrice).toFixed(2)) : "-",
    profit: priced[i]?.profit ?? null,
  }));

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
        extra={
          mode === "create" ? (
            <Tag color="green" style={{ padding: "4px 10px" }}>
              Invoice number is given on save
            </Tag>
          ) : undefined
        }
      />
      <Form<InvoiceForm>
        form={form}
        name="airInvoice"
        layout="vertical"
        requiredMark="optional"
        initialValues={
          initial
            ? toForm(initial)
            : {
                date: dayjs(today),
                tickets: [emptyTicket(today)],
                showDiscount: true,
                payment: { date: dayjs(today) },
              }
        }
        onValuesChange={onValuesChange}
        scrollToFirstError
      >
        <div className="inv-layout">
          <div className="inv-main">
            <Card title="Client & invoice" style={{ marginBottom: 16 }}>
              <ClientField formName="airInvoice" invoiceType={type} />
              <Row gutter={16}>
                <Col xs={12} md={6}>
                  <Form.Item
                    label="Invoice date"
                    name="date"
                    rules={[{ required: true, message: "Choose a date" }]}
                  >
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item label="Due date" name="dueDate">
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
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
                <Col xs={24} md={12}>
                  <Form.Item label="Referred by agent" name="agentId">
                    <PartySelect party="agents" id="airInvoice_agentId" placeholder="Optional" />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
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
                    const t = values?.tickets?.[index];
                    const heading = [t?.route, airlines.find((a) => a.value === t?.airlineId)?.label]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <Card
                        key={field.key}
                        style={{ marginBottom: 16 }}
                        styles={{ header: { background: "#fbfcfc" } }}
                        title={
                          <Space size={10}>
                            <span className="inv-badge">{index + 1}</span>
                            <span>Ticket</span>
                            {heading && (
                              <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
                                {heading}
                              </Typography.Text>
                            )}
                          </Space>
                        }
                        extra={
                          <Space>
                            <Tooltip title="Copy this ticket (same route and fares)">
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                aria-label="Copy this ticket"
                                onClick={() => {
                                  const cur = form.getFieldValue(["tickets", index]) as TicketForm;
                                  add(
                                    {
                                      ...cur,
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
                          <Col xs={12} md={6}>
                            <Form.Item
                              label="Ticket no."
                              name={[field.name, "ticketNo"]}
                              rules={[{ required: true, message: "Required" }]}
                            >
                              <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
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
                          <Col xs={24} md={12}>
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
                          <Col xs={12} md={6}>
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
                              <Input
                                placeholder="DAC-DXB-DAC"
                                style={{ textTransform: "uppercase" }}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item label="PNR" name={[field.name, "pnr"]}>
                              <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item label="GDS PNR" name={[field.name, "gdsPnr"]}>
                              <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item label="GDS" name={[field.name, "gds"]}>
                              <Input maxLength={30} placeholder="Sabre, Galileo, ..." />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item label="Class" name={[field.name, "cabinClass"]}>
                              <Input maxLength={20} placeholder="Economy" />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item label="Issue date" name={[field.name, "issueDate"]}>
                              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item
                              label="Journey date"
                              name={[field.name, "journeyDate"]}
                              rules={[{ required: true, message: "Required" }]}
                            >
                              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item label="Return date" name={[field.name, "returnDate"]}>
                              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                            </Form.Item>
                          </Col>
                        </Row>

                        <div className="inv-subhead">Fare</div>
                        <Flex gap={20} wrap>
                          <div className="line-row" style={{ flex: "2 1 420px", minWidth: 0 }}>
                            <Row gutter={12}>
                              <Col xs={12} md={8}>
                                <Form.Item
                                  label="Base fare"
                                  name={[field.name, "baseFare"]}
                                  rules={nonCommission ? [] : [{ required: true, message: "Required" }]}
                                >
                                  <MoneyInput />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={16}>
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
                                              aria-label="Remove tax"
                                              onClick={() => tax.remove(tf.name)}
                                            />
                                          </Space.Compact>
                                        ))}
                                        <Button
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
                              <Col xs={12} md={8}>
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
                              <Col xs={12} md={8}>
                                <Form.Item
                                  label="Client price"
                                  name={[field.name, "clientPrice"]}
                                  rules={[{ required: true, message: "Required" }]}
                                >
                                  <MoneyInput />
                                </Form.Item>
                              </Col>
                              <Col xs={12} md={8}>
                                <Form.Item
                                  label="Extra fee"
                                  name={[field.name, "extraFee"]}
                                  tooltip="Part of the client price (e.g. a service fee). Shown on its own line when the invoice says so."
                                >
                                  <MoneyInput placeholder="0.00" />
                                </Form.Item>
                              </Col>
                            </Row>
                          </div>
                          <div className="inv-calc">
                            <span className="inv-calc-title">This ticket</span>
                            <Line label="Total fare" value={money(p?.totalFare)} />
                            {!nonCommission && (
                              <>
                                <Line label="Commission" value={`- ${money(p?.commissionAmount)}`} />
                                <Line label="AIT" value={`+ ${money(p?.aitAmount)}`} />
                              </>
                            )}
                            <div className="inv-calc-rule" />
                            <Line label="We pay" value={money(p?.purchasePrice)} strong />
                            <Line
                              label="Client pays"
                              value={t?.clientPrice ? formatMoney(d(t.clientPrice).toFixed(2)) : "-"}
                              strong
                            />
                            <div
                              className="inv-profit"
                              data-negative={p && p.profit.isNegative() ? "true" : "false"}
                            >
                              <span>Profit</span>
                              <span>{money(p?.profit)}</span>
                            </div>
                          </div>
                        </Flex>

                        <div className="inv-subhead">Passenger</div>
                        <Row gutter={12}>
                          <Col xs={24} md={10}>
                            <Form.Item
                              label="Passenger name"
                              name={[field.name, "passengerName"]}
                              rules={[{ required: true, message: "Required" }]}
                            >
                              <Input maxLength={120} style={{ textTransform: "uppercase" }} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item label="Pax type" name={[field.name, "passengerType"]}>
                              <Select options={[...PASSENGER_TYPE_OPTIONS]} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={8}>
                            <Form.Item label="Passport no." name={[field.name, "passportNo"]}>
                              <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.List name={[field.name, "segments"]}>
                          {(segs, seg) => (
                            <>
                              {segs.length > 0 && (
                                <div className="inv-subhead">Flight details</div>
                              )}
                              {segs.map((sf) => (
                                <Row gutter={8} key={sf.key} align="bottom">
                                  <Col xs={6} md={3}>
                                    <Form.Item
                                      label="From"
                                      name={[sf.name, "from"]}
                                      rules={[{ required: true, pattern: /^[A-Za-z]{3}$/, message: "e.g. DAC" }]}
                                    >
                                      <Input maxLength={3} style={{ textTransform: "uppercase" }} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={6} md={3}>
                                    <Form.Item
                                      label="To"
                                      name={[sf.name, "to"]}
                                      rules={[{ required: true, pattern: /^[A-Za-z]{3}$/, message: "e.g. DXB" }]}
                                    >
                                      <Input maxLength={3} style={{ textTransform: "uppercase" }} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={6} md={3}>
                                    <Form.Item label="Airline code" name={[sf.name, "airline"]}>
                                      <Input maxLength={3} style={{ textTransform: "uppercase" }} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={6} md={3}>
                                    <Form.Item label="Flight no." name={[sf.name, "flightNo"]}>
                                      <Input maxLength={10} style={{ textTransform: "uppercase" }} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={12} md={5}>
                                    <Form.Item label="Fly date" name={[sf.name, "date"]}>
                                      <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={5} md={3}>
                                    <Form.Item
                                      label="Departs"
                                      name={[sf.name, "departs"]}
                                      rules={[{ pattern: /^([01]\d|2[0-3]):[0-5]\d$/, message: "HH:MM" }]}
                                    >
                                      <Input placeholder="10:35" maxLength={5} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={5} md={3}>
                                    <Form.Item
                                      label="Arrives"
                                      name={[sf.name, "arrives"]}
                                      rules={[{ pattern: /^([01]\d|2[0-3]):[0-5]\d$/, message: "HH:MM" }]}
                                    >
                                      <Input placeholder="13:55" maxLength={5} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={2} md={1}>
                                    <Form.Item label=" " colon={false}>
                                      <Button
                                        icon={<MinusCircleOutlined />}
                                        aria-label="Remove flight"
                                        onClick={() => seg.remove(sf.name)}
                                      />
                                    </Form.Item>
                                  </Col>
                                </Row>
                              ))}
                              <Space wrap>
                                <Button
                                  size="small"
                                  type="dashed"
                                  icon={<PlusOutlined />}
                                  onClick={() => seg.add({})}
                                  disabled={segs.length >= 12}
                                >
                                  Flight segment
                                </Button>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  Optional: flight numbers and times printed on the invoice.
                                </Typography.Text>
                              </Space>
                            </>
                          )}
                        </Form.List>
                      </Card>
                    );
                  })}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    style={{ marginBottom: 16, height: 48 }}
                    onClick={() => add(emptyTicket(today))}
                    disabled={fields.length >= 50}
                  >
                    Add ticket
                  </Button>
                </>
              )}
            </Form.List>

            {canReceive && (
              <Card
                style={{ marginBottom: 16 }}
                title={
                  <Flex justify="space-between" align="center">
                    <span>
                      Receive payment now
                      <Typography.Text
                        type="secondary"
                        style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}
                      >
                        A money receipt is made with the invoice
                      </Typography.Text>
                    </span>
                    <Switch
                      checked={receive}
                      onChange={setReceive}
                      aria-label="Receive payment now"
                    />
                  </Flex>
                }
                styles={{ body: receive ? undefined : { display: "none" } }}
              >
                {receive && (
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="Into account"
                        name={["payment", "moneyAccountId"]}
                        rules={[{ required: true, message: "Choose the account" }]}
                      >
                        <Select options={accounts} placeholder="Cash, bank, bKash…" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Item
                        label="Method"
                        name={["payment", "paymentMethod"]}
                        rules={[{ required: true, message: "Choose how" }]}
                      >
                        <Select
                          options={[
                            { value: "CASH", label: "Cash" },
                            { value: "BANK", label: "Bank" },
                            { value: "MOBILE", label: "Mobile banking" },
                            { value: "CARD", label: "Card" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Item
                        label="Payment amount"
                        name={["payment", "amount"]}
                        rules={[{ required: true, message: "Enter the amount" }]}
                      >
                        <MoneyInput placeholder="0.00" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item label="Payment date" name={["payment", "date"]}>
                        <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={8}>
                      <Form.Item label="Payment reference" name={["payment", "reference"]}>
                        <Input maxLength={80} placeholder="Transaction ID, slip no." />
                      </Form.Item>
                    </Col>
                  </Row>
                )}
              </Card>
            )}
          </div>

          <aside className="inv-aside">
            <Card
              title="Summary"
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: 0 } }}
              extra={
                due && due.greaterThan(0) ? (
                  <Tag color="red">Due {formatMoney(due.toFixed(2))}</Tag>
                ) : due && totals && d(totals.netTotal.toFixed(2)).greaterThan(0) ? (
                  <Tag color="green">Paid in full</Tag>
                ) : null
              }
            >
              <Table
                size="small"
                pagination={false}
                dataSource={summaryRows}
                columns={[
                  {
                    title: "Ticket",
                    dataIndex: "ticket",
                    render: (v: string, r) => (
                      <span>
                        {v}
                        {r.passenger && (
                          <Typography.Text
                            type="secondary"
                            style={{ display: "block", fontSize: 12 }}
                          >
                            {r.passenger}
                          </Typography.Text>
                        )}
                      </span>
                    ),
                  },
                  { title: "Sales", dataIndex: "sales", align: "right" },
                  {
                    title: "Profit",
                    dataIndex: "profit",
                    align: "right",
                    render: (v: { isNegative(): boolean; toFixed(n: number): string } | null) =>
                      v ? (
                        <Typography.Text type={v.isNegative() ? "danger" : "success"}>
                          {formatMoney(v.toFixed(2))}
                        </Typography.Text>
                      ) : (
                        "-"
                      ),
                  },
                ]}
              />
              <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
                <Line label="Subtotal" value={money(totals?.subtotal)} />
                <Row gutter={8}>
                  <Col span={8}>
                    <Form.Item label="Discount" name="discount" style={{ marginBottom: 0 }}>
                      <MoneyInput placeholder="0.00" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Service charge" name="serviceCharge" style={{ marginBottom: 0 }}>
                      <MoneyInput placeholder="0.00" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="VAT" name="vat" style={{ marginBottom: 0 }}>
                      <MoneyInput placeholder="0.00" />
                    </Form.Item>
                  </Col>
                </Row>
                <Flex
                  justify="space-between"
                  align="baseline"
                  style={{ borderTop: `1px solid ${THEME.line}`, paddingTop: 12 }}
                >
                  <span style={{ fontWeight: 600 }}>Net total</span>
                  <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {money(totals?.netTotal)}
                  </span>
                </Flex>
                {receive && <Line label="Received now" value={`- ${money(received)}`} />}
                <Line
                  label="Invoice due"
                  value={money(due)}
                  strong
                  tone={due && due.greaterThan(0) ? "danger" : undefined}
                />
                <Line label="Payable to vendors" value={money(totals?.totalCost)} />
                <Line
                  label="Profit"
                  value={money(totals?.profit)}
                  strong
                  tone={totals && d(totals.profit).isNegative() ? "danger" : "success"}
                />
              </div>
            </Card>

            <Card title="On the printed invoice" size="small" style={{ marginBottom: 16 }}>
              {(
                [
                  ["showPrevDue", "Show previous due"],
                  ["showDiscount", "Show discount"],
                  ["showExtraFee", "Show extra fee"],
                ] as const
              ).map(([name, label]) => (
                <Flex key={name} justify="space-between" align="center" style={{ marginBottom: 10 }}>
                  <span>{label}</span>
                  <Form.Item name={name} valuePropName="checked" noStyle>
                    <Switch size="small" aria-label={label} />
                  </Form.Item>
                </Flex>
              ))}
              <Form.Item label="Reference" name="reference">
                <Input maxLength={100} placeholder="e.g. corporate PO number" />
              </Form.Item>
              <Form.Item label="Note" name="note" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} maxLength={1000} placeholder="Shown on the invoice" />
              </Form.Item>
            </Card>
          </aside>
        </div>

        <div className="inv-actions">
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {(values?.tickets ?? []).length} ticket
            {(values?.tickets ?? []).length === 1 ? "" : "s"} · Net {money(totals?.netTotal)}
          </Typography.Text>
          <div style={{ flex: 1 }} />
          <Link href={invoiceId ? `${basePath}/${invoiceId}` : basePath}>
            <Button>Cancel</Button>
          </Link>
          {(mode === "create" || isDraft) && (
            <Button loading={pending} onClick={() => submit(false)}>
              Save as draft
            </Button>
          )}
          <Button type="primary" ghost loading={pending} onClick={() => submit(true, true)}>
            Post and print
          </Button>
          <Button type="primary" loading={pending} onClick={() => submit(true)}>
            {mode === "edit" && !isDraft ? "Save changes" : "Save & post"}
          </Button>
        </div>
      </Form>
    </>
  );
}
