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
  Flex,
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
import { calcItemLine } from "@/lib/calc/items";
import { formatMoney } from "@/lib/format";
import { INVOICE_TYPE_INFO } from "@/lib/invoiceTypes";
import type { FieldOption } from "@/lib/masters";
import type { ItineraryOption } from "@/server/services/invoices/itemInvoiceService";
import type { PilgrimOption } from "@/server/services/hajj/pilgrimService";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { createInvoiceAction, updateInvoiceAction } from "@/app/(app)/invoices/invoiceActions";
import { InvoiceHeaderCard } from "./InvoiceHeaderCard";
import { InvoiceTotalsCard } from "./InvoiceTotalsCard";

export type ItemFormType = "OTHER" | "OTHER_PACKAGE" | "TOUR" | "UMRAH" | "HAJJ_PRE_REG" | "HAJJ";

interface ItemRow {
  kind?: string;
  productId?: string | null;
  sourceId?: string | null;
  description?: string;
  qty?: string | null;
  unitPrice?: string | null;
  unitCost?: string | null;
  vendorId?: string | null;
  passengerName?: string | null;
  passportNo?: string | null;
  groupId?: string | null;
  roomTypeId?: string | null;
  pilgrimId?: string | null;
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
  tourGroupId?: string | null;
  groupId?: string | null;
  travelDate?: Dayjs | null;
  returnDate?: Dayjs | null;
  items?: ItemRow[];
}

export interface ItemFormInitial extends Omit<
  FormValues,
  "date" | "dueDate" | "travelDate" | "returnDate"
> {
  date: string;
  dueDate?: string | null;
  travelDate?: string | null;
  returnDate?: string | null;
}

export interface ItemFormOptions {
  employees: FieldOption[];
  products: FieldOption[];
  groups: FieldOption[];
  roomTypes: FieldOption[];
  tourGroups: FieldOption[];
  itinerary: ItineraryOption[];
  /** Hajj invoices: pilgrims to bill. */
  pilgrims: PilgrimOption[];
}

interface Props {
  type: ItemFormType;
  mode: "create" | "edit";
  invoiceId?: string;
  invoiceNumber?: string;
  isDraft?: boolean;
  initial?: ItemFormInitial;
  today: string;
  options: ItemFormOptions;
}

const KIND_OPTIONS = [
  { value: "PACKAGE", label: "Package" },
  { value: "ACCOMMODATION", label: "Accommodation" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "OTHER_TRANSPORT", label: "Other transport" },
  { value: "GUIDE", label: "Guide" },
  { value: "FOOD", label: "Food" },
  { value: "PLACE", label: "Sightseeing" },
  { value: "TOUR_TICKET", label: "Tickets" },
  { value: "SERVICE", label: "Other service" },
];

const TITLES: Record<ItemFormType, { create: string; hint: string }> = {
  OTHER: {
    create: "New Other Services Invoice",
    hint: "Any service: hotel booking, insurance, pickup, document work...",
  },
  OTHER_PACKAGE: { create: "New Package Invoice", hint: "A package of services sold together." },
  TOUR: {
    create: "New Tour Package Invoice",
    hint: "Charge the package price, and add the costs from your tour itinerary so profit is exact.",
  },
  UMRAH: { create: "New Umrah Invoice", hint: "One line per pilgrim." },
  HAJJ_PRE_REG: {
    create: "New Hajj Pre Registration Invoice",
    hint: "One line per pilgrim: the pre registration fee. Add pilgrims first under Hajj Registration.",
  },
  HAJJ: {
    create: "New Hajj Invoice",
    hint: "One line per pilgrim: the Hajj package. Name, passport and group come from the pilgrim record.",
  },
};

const iso = (v?: Dayjs | null) => (v ? v.format("YYYY-MM-DD") : null);

function newLine(type: ItemFormType): ItemRow {
  if (type === "HAJJ_PRE_REG")
    return { kind: "PILGRIM", qty: "1", description: "Pre registration fee" };
  if (type === "HAJJ") return { kind: "PILGRIM", qty: "1", description: "Hajj package" };
  if (type === "UMRAH") return { kind: "PILGRIM", qty: "1" };
  if (type === "TOUR") return { kind: "PACKAGE", qty: "1" };
  return { kind: "SERVICE", qty: "1" };
}

export function ItemInvoiceForm({
  type,
  mode,
  invoiceId,
  invoiceNumber,
  isDraft,
  initial,
  today,
  options,
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [pending, startTransition] = useTransition();
  const values = Form.useWatch([], form) as FormValues | undefined;
  const basePath = INVOICE_TYPE_INFO[type].path;
  const hajj = type === "HAJJ_PRE_REG" || type === "HAJJ";
  // Hajj lines are one per pilgrim like Umrah, but pick a pilgrim record.
  const umrah = type === "UMRAH" || hajj;
  const tour = type === "TOUR";

  const lines = useMemo(
    () =>
      (values?.items ?? []).map((it) => {
        try {
          return calcItemLine({
            qty: it?.qty || 0,
            unitPrice: it?.unitPrice || 0,
            unitCost: it?.unitCost || 0,
          });
        } catch {
          return null;
        }
      }),
    [values?.items],
  );

  const totals = useMemo(() => {
    try {
      return calcInvoiceTotals({
        lines: lines.map((l) => ({
          clientPrice: l?.clientPrice ?? 0,
          purchasePrice: l?.purchasePrice ?? 0,
        })),
        discount: values?.discount || 0,
        serviceCharge: values?.serviceCharge || 0,
        vat: values?.vat || 0,
        agentCommission: values?.agentCommission || 0,
      });
    } catch {
      return null;
    }
  }, [lines, values?.discount, values?.serviceCharge, values?.vat, values?.agentCommission]);

  function addFromItinerary(id: string) {
    const opt = options.itinerary.find((o) => o.id === id);
    if (!opt) return;
    const items = (form.getFieldValue("items") as ItemRow[] | undefined) ?? [];
    form.setFieldValue("items", [
      ...items,
      {
        kind: opt.kind,
        sourceId: opt.id,
        description: opt.name,
        qty: "1",
        unitPrice: "0",
        unitCost: opt.cost,
        vendorId: opt.vendorId,
      },
    ]);
  }

  function submit(post: boolean) {
    form
      .validateFields()
      .then((v) => {
        const payload = {
          ...v,
          date: iso(v.date),
          dueDate: iso(v.dueDate),
          travelDate: iso(v.travelDate),
          returnDate: iso(v.returnDate),
          items: (v.items ?? []).map((it) => ({ ...it, qty: umrah ? "1" : it.qty })),
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

  const itineraryGroups = Object.entries(
    options.itinerary.reduce<Record<string, ItineraryOption[]>>((acc, o) => {
      (acc[o.group] ??= []).push(o);
      return acc;
    }, {}),
  ).map(([label, opts]) => ({
    label,
    options: opts.map((o) => ({ value: o.id, label: `${o.name} · ${formatMoney(o.cost)}` })),
  }));

  const headerExtra = (
    <>
      {tour && (
        <Col xs={24} md={12} xl={8}>
          <Form.Item label="Tour group" name="tourGroupId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={options.tourGroups}
              placeholder="Optional"
            />
          </Form.Item>
        </Col>
      )}
      {umrah && (
        <Col xs={24} md={12} xl={8}>
          <Form.Item label="Group" name="groupId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={options.groups}
              placeholder="Optional"
            />
          </Form.Item>
        </Col>
      )}
      {(tour || umrah) && (
        <>
          <Col xs={12} md={6} xl={4}>
            <Form.Item label="Travel date" name="travelDate">
              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6} xl={4}>
            <Form.Item label="Return date" name="returnDate">
              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        title={mode === "create" ? TITLES[type].create : `Edit ${invoiceNumber}`}
        description={
          mode === "edit" && !isDraft
            ? "This invoice is posted. Saving reverses its old ledger entry and posts the new figures."
            : TITLES[type].hint
        }
      />
      <Form<FormValues>
        form={form}
        name="itemInvoice"
        layout="vertical"
        requiredMark="optional"
        scrollToFirstError
        initialValues={
          initial
            ? {
                ...initial,
                date: dayjs(initial.date),
                dueDate: initial.dueDate ? dayjs(initial.dueDate) : null,
                travelDate: initial.travelDate ? dayjs(initial.travelDate) : null,
                returnDate: initial.returnDate ? dayjs(initial.returnDate) : null,
              }
            : { date: dayjs(today), items: [newLine(type)] }
        }
      >
        <InvoiceHeaderCard
          formName="itemInvoice"
          employees={options.employees}
          extra={headerExtra}
        />

        <Card
          title={umrah ? "Pilgrims" : "Lines"}
          style={{ marginBottom: 16 }}
          extra={
            tour &&
            itineraryGroups.length > 0 && (
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Add a cost from the itinerary"
                style={{ width: 320 }}
                value={null}
                options={itineraryGroups}
                onChange={(id) => id && addFromItinerary(id)}
                aria-label="Add from itinerary"
              />
            )
          }
        >
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => {
                  const l = lines[index];
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
                        {hajj ? (
                          <>
                            <Col xs={24} md={12} xl={type === "HAJJ" ? 6 : 8}>
                              <Form.Item
                                label="Pilgrim"
                                name={[field.name, "pilgrimId"]}
                                rules={[{ required: true, message: "Choose the pilgrim" }]}
                              >
                                <Select
                                  showSearch
                                  optionFilterProp="label"
                                  options={options.pilgrims}
                                  placeholder="Name, passport or tracking no."
                                  notFoundContent="No active pilgrims. Add them under Hajj Registration."
                                />
                              </Form.Item>
                            </Col>
                            {type === "HAJJ" && (
                              <Col xs={12} md={4} xl={2}>
                                <Form.Item label="Room" name={[field.name, "roomTypeId"]}>
                                  <Select allowClear options={options.roomTypes} />
                                </Form.Item>
                              </Col>
                            )}
                          </>
                        ) : umrah ? (
                          <>
                            <Col xs={24} md={8} xl={5}>
                              <Form.Item
                                label="Pilgrim name"
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
                            <Col xs={12} md={4} xl={3}>
                              <Form.Item label="Room" name={[field.name, "roomTypeId"]}>
                                <Select allowClear options={options.roomTypes} />
                              </Form.Item>
                            </Col>
                          </>
                        ) : (
                          <>
                            {tour ? (
                              <Col xs={12} md={6} xl={3}>
                                <Form.Item label="Kind" name={[field.name, "kind"]}>
                                  <Select options={KIND_OPTIONS} />
                                </Form.Item>
                              </Col>
                            ) : (
                              <Col xs={12} md={6} xl={4}>
                                <Form.Item label="Product" name={[field.name, "productId"]}>
                                  <Select
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={options.products}
                                    onChange={(_, opt) => {
                                      const label = (opt as FieldOption | undefined)?.label;
                                      if (
                                        label &&
                                        !form.getFieldValue(["items", field.name, "description"])
                                      ) {
                                        form.setFieldValue(
                                          ["items", field.name, "description"],
                                          label,
                                        );
                                      }
                                    }}
                                  />
                                </Form.Item>
                              </Col>
                            )}
                            <Col xs={12} md={4} xl={2}>
                              <Form.Item
                                label="Qty"
                                name={[field.name, "qty"]}
                                rules={[{ required: true, message: "Required" }]}
                              >
                                <MoneyInput precision={2} />
                              </Form.Item>
                            </Col>
                          </>
                        )}
                        <Col xs={24} md={umrah ? 8 : 10} xl={umrah ? 5 : 6}>
                          <Form.Item
                            label={
                              type === "HAJJ_PRE_REG" ? "Fee" : umrah ? "Package" : "Description"
                            }
                            name={[field.name, "description"]}
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <Input maxLength={300} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4} xl={2}>
                          <Form.Item
                            label={umrah ? "Price" : "Unit price"}
                            name={[field.name, "unitPrice"]}
                          >
                            <MoneyInput placeholder="0.00" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4} xl={2}>
                          <Form.Item
                            label={umrah ? "Cost" : "Unit cost"}
                            name={[field.name, "unitCost"]}
                          >
                            <MoneyInput placeholder="0.00" />
                          </Form.Item>
                        </Col>
                        <Col xs={20} md={8} xl={umrah ? 3 : 4}>
                          <Form.Item label="Vendor" name={[field.name, "vendorId"]}>
                            <PartySelect party="vendors" placeholder="Who you pay" />
                          </Form.Item>
                        </Col>
                        <Col xs={4} md={2} xl={1}>
                          <Form.Item label=" ">
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              aria-label={`Remove line ${index + 1}`}
                              disabled={fields.length === 1}
                              onClick={() => remove(field.name)}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Space size="large" style={{ fontSize: 12 }}>
                        <Typography.Text type="secondary">
                          Client: {money(l?.clientPrice)}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          Cost: {money(l?.purchasePrice)}
                        </Typography.Text>
                        <Typography.Text type={l?.profit.isNegative() ? "danger" : "success"}>
                          Profit: {money(l?.profit)}
                        </Typography.Text>
                      </Space>
                    </div>
                  );
                })}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add(newLine(type))}
                >
                  {umrah ? "Add pilgrim" : "Add line"}
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        <InvoiceTotalsCard totals={totals} />

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
