"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { CloudServerOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { NAV } from "@/lib/nav";
import { PLAN_MODULES } from "@/lib/subscription";
import type { AgencyRow, PlanRow } from "@/server/services/admin/adminService";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { AgencyPaymentsModal } from "./AgencyPaymentsModal";
import { applyActionResult } from "@/components/formResult";
import {
  createAgencyAction,
  openAgencyAction,
  savePlanAction,
  setAgencyStatusAction,
  setAgencySubscriptionAction,
} from "@/app/(app)/platform/actions";

interface Props {
  agencies: AgencyRow[];
  plans: PlanRow[];
}

interface NewAgency {
  code: string;
  name: string;
  phone?: string;
  email?: string;
  owner: { name: string; username: string; password: string };
}

interface SubscriptionForm {
  plan: string;
  status: "TRIAL" | "ACTIVE";
  trialEndsAt?: Dayjs | null;
  paidUntil?: Dayjs | null;
}

interface PlanForm {
  code: string;
  name: string;
  priceMonthly: string;
  priceYearly: string;
  maxUsers: number;
  sortOrder: number;
  isActive: boolean;
  everyModule: boolean;
  modules: string[];
}

const MODULE_LABEL = Object.fromEntries(NAV.map((m) => [m.module, m.label]));
const MODULE_OPTIONS = PLAN_MODULES.map((m) => ({ value: m, label: MODULE_LABEL[m] ?? m }));
const iso = (d?: Dayjs | null) => (d ? d.format("YYYY-MM-DD") : null);

/** How an agency's subscription stands, as a tag. */
function SubscriptionTag({ a }: { a: AgencyRow }) {
  if (a.status === "SUSPENDED") return <Tag color="red">Suspended</Tag>;
  const s = a.subscription;
  const end = a.status === "TRIAL" ? a.trialEndsOn : a.paidUntilOn;
  if (!end) return <Tag color="green">No end date</Tag>;
  if (s.state === "expired") return <Tag color="red">Expired · read only</Tag>;
  if (s.state === "grace") return <Tag color="orange">Unpaid since {formatDate(end)}</Tag>;
  const label = a.status === "TRIAL" ? `Trial to ${formatDate(end)}` : `Paid to ${formatDate(end)}`;
  return <Tag color={s.state === "ending" ? "gold" : "green"}>{label}</Tag>;
}

export function AdminPage({ agencies, plans }: Props) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<NewAgency>();
  const [subFor, setSubFor] = useState<AgencyRow | null>(null);
  const [payFor, setPayFor] = useState<AgencyRow | null>(null);
  const [subForm] = Form.useForm<SubscriptionForm>();
  const subStatus = Form.useWatch("status", subForm);
  const [planFor, setPlanFor] = useState<PlanRow | "new" | null>(null);
  const [planForm] = Form.useForm<PlanForm>();
  const everyModule = Form.useWatch("everyModule", planForm);

  const planName = Object.fromEntries(plans.map((p) => [p.code, p]));
  const planOptions = plans
    .filter((p) => p.isActive)
    .map((p) => ({ value: p.code, label: p.name }));

  async function create() {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    const r = await createAgencyAction({
      ...v,
      phone: v.phone || undefined,
      email: v.email || undefined,
    });
    setSaving(false);
    if (applyActionResult(r, form, message, `Agency ${r.ok ? r.data.code : ""} created`)) {
      setCreating(false);
      form.resetFields();
      router.refresh();
    }
  }

  function subscriptionValues(a: AgencyRow): SubscriptionForm {
    return {
      plan: a.plan,
      status: a.status === "TRIAL" ? "TRIAL" : "ACTIVE",
      trialEndsAt: a.trialEndsOn ? dayjs(a.trialEndsOn) : null,
      paidUntil: a.paidUntilOn ? dayjs(a.paidUntilOn) : null,
    };
  }

  async function saveSubscription() {
    if (!subFor) return;
    const v = await subForm.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    const r = await setAgencySubscriptionAction(subFor.id, {
      plan: v.plan,
      status: v.status,
      trialEndsAt: v.status === "TRIAL" ? iso(v.trialEndsAt) : null,
      paidUntil: iso(v.paidUntil),
    });
    setSaving(false);
    if (applyActionResult(r, subForm, message, "Subscription saved")) {
      setSubFor(null);
      router.refresh();
    }
  }

  function planValues(p: PlanRow | "new"): Partial<PlanForm> {
    return p === "new"
      ? {
          priceMonthly: "0",
          priceYearly: "0",
          maxUsers: 5,
          sortOrder: plans.length + 1,
          isActive: true,
          everyModule: true,
          modules: [],
        }
      : { ...p, everyModule: p.modules.length === 0 };
  }

  async function savePlan() {
    const v = await planForm.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    const { everyModule: all, ...rest } = v;
    const r = await savePlanAction(planFor === "new" || !planFor ? null : planFor.id, {
      ...rest,
      modules: all ? [] : rest.modules,
    });
    setSaving(false);
    if (applyActionResult(r, planForm, message, "Plan saved")) {
      setPlanFor(null);
      router.refresh();
    }
  }

  function toggle(a: AgencyRow) {
    const suspend = a.status !== "SUSPENDED";
    modal.confirm({
      title: `${suspend ? "Suspend" : "Activate"} ${a.name}?`,
      content: suspend
        ? "Nobody in this agency can sign in until it is activated again. Data is kept."
        : "Users of this agency can sign in again.",
      okText: suspend ? "Suspend" : "Activate",
      okButtonProps: { danger: suspend },
      onOk: async () => {
        const r = await setAgencyStatusAction(a.id, suspend ? "SUSPENDED" : "ACTIVE");
        if (applyActionResult(r, null, message, "Saved")) router.refresh();
      },
    });
  }

  function open(a: AgencyRow) {
    modal.confirm({
      title: `Open ${a.name} as its owner?`,
      content:
        "You will be signed out of your own account and into this agency. Everything you do there is recorded in its audit log under your name. Sign out to end.",
      okText: "Open",
      onOk: async () => {
        const r = await openAgencyAction(a.id);
        // On success the action redirects; only failures come back here.
        if (!r.ok) message.error(r.error);
      },
    });
  }

  const columns: TableColumnsType<AgencyRow> = [
    {
      title: "Agency",
      key: "n",
      render: (_, a) => (
        <>
          {a.name} {a.isOwn && <Tag>yours</Tag>}
          <div style={{ fontSize: 12, color: "#888" }}>
            {a.code}
            {a.phone && ` · ${a.phone}`}
          </div>
        </>
      ),
    },
    {
      title: "Plan",
      key: "p",
      render: (_, a) => planName[a.plan]?.name ?? a.plan,
    },
    { title: "Subscription", key: "s", render: (_, a) => <SubscriptionTag a={a} /> },
    {
      title: "Users",
      key: "u",
      align: "right",
      render: (_, a) => {
        const max = planName[a.plan]?.maxUsers ?? 0;
        return max ? `${a.users} / ${max}` : a.users;
      },
    },
    { title: "Clients", dataIndex: "clients", key: "c", align: "right" },
    { title: "Invoices", dataIndex: "invoices", key: "i", align: "right" },
    { title: "Since", dataIndex: "createdAt", key: "since", render: (v) => formatDate(v) },
    {
      title: "Last sign in",
      dataIndex: "lastLoginAt",
      key: "ll",
      render: (v: string | null) => (v ? formatDateTime(v) : "-"),
    },
    {
      title: "",
      key: "act",
      render: (_, a) => (
        <Space size={4}>
          {a.status !== "SUSPENDED" && (
            <Button size="small" onClick={() => setSubFor(a)}>
              Subscription
            </Button>
          )}
          {a.status !== "SUSPENDED" && !a.isOwn && (
            <Button size="small" onClick={() => setPayFor(a)}>
              Payments
            </Button>
          )}
          {!a.isOwn && a.status !== "SUSPENDED" && (
            <Button size="small" onClick={() => open(a)}>
              Open as owner
            </Button>
          )}
          {!a.isOwn && (
            <Button size="small" danger={a.status !== "SUSPENDED"} onClick={() => toggle(a)}>
              {a.status !== "SUSPENDED" ? "Suspend" : "Activate"}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const planColumns: TableColumnsType<PlanRow> = [
    {
      title: "Plan",
      key: "n",
      render: (_, p) => (
        <>
          {p.name} {!p.isActive && <Tag>hidden</Tag>}
          <div style={{ fontSize: 12, color: "#888" }}>{p.code}</div>
        </>
      ),
    },
    {
      title: "Monthly (BDT)",
      dataIndex: "priceMonthly",
      key: "m",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Yearly (BDT)",
      dataIndex: "priceYearly",
      key: "y",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Users",
      dataIndex: "maxUsers",
      key: "u",
      align: "right",
      render: (v: number) => (v ? v : "No limit"),
    },
    {
      title: "Modules",
      key: "mod",
      render: (_, p) =>
        p.modules.length ? `${p.modules.length} of ${PLAN_MODULES.length}` : "All",
    },
    { title: "Agencies", dataIndex: "agencies", key: "a", align: "right" },
    {
      title: "",
      key: "act",
      render: (_, p) => (
        <Button size="small" onClick={() => setPlanFor(p)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Platform admin"
        description="Every agency on this installation and the plans they are on. Only platform administrators see this page."
        extra={
          <>
            <Button icon={<CloudServerOutlined />} href="/admin/backups">
              Database backups
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
              New agency
            </Button>
          </>
        }
      />
      <Card>
        <Tabs
          items={[
            {
              key: "agencies",
              label: `Agencies (${agencies.length})`,
              children: (
                <Table<AgencyRow>
                  rowKey="id"
                  size="middle"
                  dataSource={agencies}
                  columns={columns}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />
              ),
            },
            {
              key: "plans",
              label: `Plans (${plans.length})`,
              children: (
                <>
                  <Typography.Paragraph type="secondary">
                    Prices are shown to agencies on their Subscription page. Dashboard, Settings and
                    Feedback are in every plan.
                  </Typography.Paragraph>
                  <Table<PlanRow>
                    rowKey="id"
                    size="middle"
                    dataSource={plans}
                    columns={planColumns}
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    footer={() => (
                      <Button icon={<PlusOutlined />} onClick={() => setPlanFor("new")}>
                        Add plan
                      </Button>
                    )}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        title="New agency"
        okText="Create"
        okButtonProps={{ loading: saving }}
        onOk={create}
        onCancel={() => setCreating(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="Agency code (used to sign in)"
            rules={[
              { required: true, message: "Required" },
              {
                pattern: /^[a-z0-9][a-z0-9-]{1,38}$/,
                message: "2 to 39 lowercase letters, digits or dashes",
              },
            ]}
          >
            <Input placeholder="e.g. skyline" />
          </Form.Item>
          <Form.Item name="name" label="Agency name" rules={[{ required: true, min: 2 }]}>
            <Input />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="phone" label="Phone" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" style={{ flex: 1 }} rules={[{ type: "email" }]}>
              <Input />
            </Form.Item>
          </Space.Compact>
          <Divider plain>Owner account</Divider>
          <Form.Item
            name={["owner", "name"]}
            label="Owner name"
            rules={[{ required: true, min: 2 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name={["owner", "username"]}
            label="Username"
            rules={[
              { required: true, message: "Required" },
              { pattern: /^[a-z0-9._-]{3,60}$/, message: "3+ lowercase letters, digits, . _ -" },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name={["owner", "password"]}
            label="First password"
            rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      {payFor && (
        <AgencyPaymentsModal
          agency={payFor}
          plans={plans}
          onClose={() => setPayFor(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {subFor && (
        <Modal
          open
          title={`Subscription · ${subFor.name}`}
          okText="Save"
          okButtonProps={{ loading: saving }}
          onOk={saveSubscription}
          onCancel={() => setSubFor(null)}
        >
          <Form
            form={subForm}
            name="subscription"
            layout="vertical"
            initialValues={subscriptionValues(subFor)}
          >
            <Form.Item
              name="plan"
              label="Plan"
              rules={[{ required: true, message: "Choose a plan" }]}
            >
              <Select options={planOptions} />
            </Form.Item>
            <Form.Item name="status" label="Stage">
              <Radio.Group
                options={[
                  { value: "TRIAL", label: "Trial" },
                  { value: "ACTIVE", label: "Paying" },
                ]}
                optionType="button"
              />
            </Form.Item>
            {subStatus === "TRIAL" ? (
              <Form.Item
                name="trialEndsAt"
                label="Trial ends on"
                rules={[{ required: true, message: "A trial needs an end date" }]}
                extra="After this day the agency can only view and export until it pays."
              >
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            ) : (
              <Form.Item
                name="paidUntil"
                label="Paid until"
                extra="Leave empty for no end date. After it, 7 days of grace, then view and export only."
              >
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            )}
          </Form>
        </Modal>
      )}

      {planFor && (
        <Modal
          open
          title={planFor === "new" ? "Add plan" : "Edit plan"}
          okText="Save"
          okButtonProps={{ loading: saving }}
          onOk={savePlan}
          onCancel={() => setPlanFor(null)}
          width={680}
        >
          <Form
            form={planForm}
            name="plan"
            layout="vertical"
            requiredMark="optional"
            initialValues={planValues(planFor)}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}>
                  <Input maxLength={80} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="Code"
                  rules={[
                    { required: true, message: "Required" },
                    {
                      pattern: /^[a-z0-9][a-z0-9-]{1,38}$/,
                      message: "2 to 39 lowercase letters, digits or dashes",
                    },
                  ]}
                >
                  <Input maxLength={39} placeholder="e.g. standard" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="priceMonthly"
                  label="Monthly price (BDT)"
                  rules={[{ required: true }]}
                >
                  <MoneyInput />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="priceYearly"
                  label="Yearly price (BDT)"
                  rules={[{ required: true }]}
                >
                  <MoneyInput />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="maxUsers"
                  label="Active users"
                  extra="0 = no limit"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} max={10000} precision={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="sortOrder" label="Order">
                  <InputNumber min={0} max={1000} precision={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item
                  name="isActive"
                  label="Offered"
                  valuePropName="checked"
                  extra="Hidden plans stay on the agencies that have them."
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="everyModule" valuePropName="checked" style={{ marginBottom: 8 }}>
                  <Checkbox>Every module</Checkbox>
                </Form.Item>
                {!everyModule && (
                  <Form.Item
                    name="modules"
                    rules={[{ required: true, message: "Pick at least one module" }]}
                  >
                    <Checkbox.Group
                      options={MODULE_OPTIONS}
                      style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}
                    />
                  </Form.Item>
                )}
              </Col>
            </Row>
          </Form>
        </Modal>
      )}
    </>
  );
}
