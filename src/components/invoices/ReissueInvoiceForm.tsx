"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { calcInvoiceTotals } from "@/lib/calc/invoiceTotals";
import { d } from "@/lib/calc/money";
import { calcReissueLine } from "@/lib/calc/reissue";
import { formatDate, formatMoney } from "@/lib/format";
import type { FieldOption } from "@/lib/masters";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import {
  createInvoiceAction,
  reissuableTicketsAction,
  updateInvoiceAction,
} from "@/app/(app)/invoices/invoiceActions";
import type { ReissuableTicket } from "@/server/services/invoices/reissueInvoiceService";
import { InvoiceHeaderCard } from "./InvoiceHeaderCard";
import {
  InvoiceActionBar,
  InvoiceSummaryAside,
  ReceivePaymentCard,
  methodForAccount,
  openPrintWindow,
  paymentPayload,
  type AccountOption,
  type PaymentFormValues,
} from "./InvoiceFormParts";

interface Line {
  originalTicketId?: string;
  ticketNo?: string | null;
  pnr?: string | null;
  vendorId?: string | null;
  journeyDate?: Dayjs | null;
  returnDate?: Dayjs | null;
  penalty?: string | null;
  fareDifference?: string | null;
  serviceCharge?: string | null;
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
  reference?: string | null;
  showPrevDue?: boolean;
  showDiscount?: boolean;
  payment?: PaymentFormValues;
  lines?: Line[];
}

type DateKeys = "journeyDate" | "returnDate";

export interface ReissueFormInitial extends Omit<FormValues, "date" | "dueDate" | "lines"> {
  date: string;
  dueDate?: string | null;
  lines: (Omit<Line, DateKeys> & { journeyDate: string; returnDate?: string | null })[];
}

interface Props {
  mode: "create" | "edit";
  invoiceId?: string;
  invoiceNumber?: string;
  isDraft?: boolean;
  initial?: ReissueFormInitial;
  /** Preselected client (from a client's profile). */
  clientId?: string;
  today: string;
  employees: FieldOption[];
  /** Accounts money can go into; empty when the user may not take payments. */
  accounts?: AccountOption[];
}

const iso = (v?: Dayjs | null) => (v ? v.format("YYYY-MM-DD") : null);

function lineFigures(l?: Line) {
  try {
    return calcReissueLine({
      penalty: l?.penalty || 0,
      fareDifference: l?.fareDifference || 0,
      serviceCharge: l?.serviceCharge || 0,
    });
  } catch {
    return null;
  }
}

export function ReissueInvoiceForm({
  mode,
  invoiceId,
  invoiceNumber,
  isDraft,
  initial,
  clientId: presetClient,
  today,
  employees,
  accounts = [],
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [pending, startTransition] = useTransition();
  const values = Form.useWatch([], form) as FormValues | undefined;
  const [receive, setReceive] = useState(false);
  const canReceive = mode === "create" && accounts.length > 0;
  const clientId = Form.useWatch("clientId", form) as string | undefined;
  const [tickets, setTickets] = useState<ReissuableTicket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setTickets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    reissuableTicketsAction(clientId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      setTickets(r.ok ? (r.data as ReissuableTicket[]) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const ticketOptions = tickets.map((t) => ({
    value: t.id,
    label: `${t.ticketNo} · ${t.passengerName} · ${t.route} · ${formatDate(t.journeyDate)}`,
  }));

  const totals = useMemo(() => {
    try {
      return calcInvoiceTotals({
        lines: (values?.lines ?? []).map((l) => {
          const f = lineFigures(l);
          return { clientPrice: f?.clientPrice ?? 0, purchasePrice: f?.purchasePrice ?? 0 };
        }),
        discount: values?.discount || 0,
        serviceCharge: values?.serviceCharge || 0,
        vat: values?.vat || 0,
        agentCommission: values?.agentCommission || 0,
      });
    } catch {
      return null;
    }
  }, [values]);

  /** Picking the original ticket fills in its vendor and current dates. */
  function onPickTicket(index: number, id: string) {
    const t = tickets.find((x) => x.id === id);
    if (!t) return;
    const lines = [...(form.getFieldValue("lines") as Line[])];
    lines[index] = {
      ...lines[index],
      originalTicketId: id,
      vendorId: lines[index]?.vendorId ?? t.vendorId,
      pnr: lines[index]?.pnr ?? t.pnr,
      journeyDate: lines[index]?.journeyDate ?? dayjs(t.journeyDate),
      returnDate: lines[index]?.returnDate ?? (t.returnDate ? dayjs(t.returnDate) : null),
    };
    form.setFieldValue("lines", lines);
  }

  function submit(post: boolean, print = false) {
    const printed = openPrintWindow(print);
    form
      .validateFields()
      .then((v) => {
        const payload = {
          ...v,
          date: iso(v.date),
          dueDate: iso(v.dueDate),
          lines: (v.lines ?? []).map((l) => ({
            ...l,
            journeyDate: iso(l.journeyDate),
            returnDate: iso(l.returnDate),
          })),
          payment: paymentPayload(v.payment, canReceive && receive && post, iso),
          post,
        };
        startTransition(async () => {
          const result =
            mode === "create"
              ? await createInvoiceAction("REISSUE", payload)
              : await updateInvoiceAction("REISSUE", invoiceId!, payload);
          if (!applyActionResult(result, form, message)) {
            printed.cancel();
            return;
          }
          const id =
            mode === "create" && result.ok ? (result.data as { id: string }).id : invoiceId!;
          message.success(post ? "Reissue saved and posted" : "Reissue saved as draft");
          printed.show(id);
          router.push(`/invoices/reissue/${id}`);
          router.refresh();
        });
      })
      .catch(() => {
        printed.cancel();
        message.error("Please fix the highlighted fields");
      });
  }

  return (
    <>
      <PageHeader
        title={mode === "create" ? "New Reissue" : `Edit ${invoiceNumber}`}
        description={
          mode === "edit" && !isDraft
            ? "This reissue is posted. Saving reverses its old ledger entry and posts the new figures."
            : "Charge only the change: airline penalty and fare difference (paid to the vendor) plus your service charge."
        }
      />
      <Form<FormValues>
        form={form}
        name="reissueInvoice"
        layout="vertical"
        requiredMark="optional"
        scrollToFirstError
        onValuesChange={(changed: Partial<FormValues>) => {
          const method = methodForAccount(accounts, changed.payment?.moneyAccountId);
          if (method) form.setFieldValue(["payment", "paymentMethod"], method);
        }}
        initialValues={
          initial
            ? {
                ...initial,
                date: dayjs(initial.date),
                dueDate: initial.dueDate ? dayjs(initial.dueDate) : null,
                lines: initial.lines.map((l) => ({
                  ...l,
                  journeyDate: dayjs(l.journeyDate),
                  returnDate: l.returnDate ? dayjs(l.returnDate) : null,
                })),
              }
            : {
                date: dayjs(today),
                clientId: presetClient ?? null,
                lines: [{}],
                showDiscount: true,
                payment: { date: dayjs(today) },
              }
        }
      >
        <div className="inv-layout">
          <div className="inv-main">
            <InvoiceHeaderCard
              formName="reissueInvoice"
              invoiceType="REISSUE"
              allowNewClient={false}
              employees={employees}
            />

            <Card title="Tickets" style={{ marginBottom: 16 }}>
              {clientId && !loading && tickets.length === 0 && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="This client has no posted air tickets that can be reissued."
                />
              )}
              <Form.List name="lines">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, index) => {
                      const f = lineFigures(values?.lines?.[index]);
                      return (
                        <div
                          key={field.key}
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            paddingBottom: 8,
                            marginBottom: 12,
                          }}
                        >
                          <Row gutter={10} align="bottom" className="line-row">
                            <Col xs={24} xxl={10}>
                              <Form.Item
                                label="Original ticket"
                                name={[field.name, "originalTicketId"]}
                                rules={[{ required: true, message: "Choose the ticket" }]}
                              >
                                <Select
                                  showSearch
                                  optionFilterProp="label"
                                  loading={loading}
                                  disabled={!clientId}
                                  placeholder={
                                    clientId ? "Ticket no. or passenger" : "Choose the client first"
                                  }
                                  options={ticketOptions}
                                  onChange={(id: string) => onPickTicket(index, id)}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={3}>
                              <Form.Item label="New ticket no." name={[field.name, "ticketNo"]}>
                                <Input maxLength={20} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={3}>
                              <Form.Item label="PNR" name={[field.name, "pnr"]}>
                                <Input maxLength={20} style={{ textTransform: "uppercase" }} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} xxl={8}>
                              <Form.Item
                                label="Vendor"
                                name={[field.name, "vendorId"]}
                                rules={[{ required: true, message: "Choose the vendor" }]}
                              >
                                <PartySelect party="vendors" />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={4}>
                              <Form.Item
                                label="New journey date"
                                name={[field.name, "journeyDate"]}
                                rules={[{ required: true, message: "Required" }]}
                              >
                                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={4}>
                              <Form.Item label="New return date" name={[field.name, "returnDate"]}>
                                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={4}>
                              <Form.Item label="Airline penalty" name={[field.name, "penalty"]}>
                                <MoneyInput placeholder="0.00" />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={4}>
                              <Form.Item
                                label="Fare difference"
                                name={[field.name, "fareDifference"]}
                              >
                                <MoneyInput placeholder="0.00" />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={3}>
                              <Form.Item
                                label="Service charge"
                                name={[field.name, "serviceCharge"]}
                              >
                                <MoneyInput placeholder="0.00" />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6} xxl={1}>
                              <Form.Item label=" ">
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  aria-label={`Remove ticket ${index + 1}`}
                                  disabled={fields.length === 1}
                                  onClick={() => remove(field.name)}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Space size="large" style={{ fontSize: 12 }}>
                            <Typography.Text type="secondary">
                              Client pays {f ? formatMoney(f.clientPrice.toFixed(2)) : "-"}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              Vendor gets {f ? formatMoney(f.purchasePrice.toFixed(2)) : "-"}
                            </Typography.Text>
                            <Typography.Text type="success">
                              Profit {f ? formatMoney(f.profit.toFixed(2)) : "-"}
                            </Typography.Text>
                          </Space>
                        </div>
                      );
                    })}
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({})}>
                      Add ticket
                    </Button>
                  </>
                )}
              </Form.List>
            </Card>

            {canReceive && (
              <ReceivePaymentCard accounts={accounts} on={receive} onChange={setReceive} />
            )}
          </div>
          <InvoiceSummaryAside
            rows={(values?.lines ?? []).map((l, i) => {
              const f = lineFigures(l);
              return {
                key: i,
                label:
                  tickets.find((t) => t.id === l?.originalTicketId)?.ticketNo ?? `Ticket ${i + 1}`,
                sub: l?.ticketNo ? `New ${l.ticketNo}` : null,
                sales: f ? formatMoney(f.clientPrice.toFixed(2)) : null,
                profit: f ? f.clientPrice.minus(f.purchasePrice) : null,
              };
            })}
            rowsTitle="Reissue"
            totals={totals}
            received={receive ? d(values?.payment?.amount) : null}
          />
        </div>

        <InvoiceActionBar
          summary={`${(values?.lines ?? []).length} reissue${(values?.lines ?? []).length === 1 ? "" : "s"}`}
          cancelHref={invoiceId ? `/invoices/reissue/${invoiceId}` : "/invoices/reissue"}
          showDraft={mode === "create" || isDraft === true}
          pending={pending}
          primaryLabel={mode === "edit" && !isDraft ? "Save changes" : "Save & post"}
          onSubmit={submit}
        />
      </Form>
    </>
  );
}
