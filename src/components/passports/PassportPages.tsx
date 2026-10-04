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
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Timeline,
  Typography,
  Upload,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  PaperClipOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { FieldOption } from "@/lib/masters";
import { EXPIRY_COLOR, EXPIRY_LABEL, type ExpiryState } from "@/lib/passport";
import type {
  PassportList,
  PassportRow,
  PassportView,
} from "@/server/services/passports/passportService";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import {
  changePassportStatusAction,
  savePassportAction,
  setPassportActiveAction,
} from "@/app/(app)/documents/actions";

export function ExpiryTag({ state, days }: { state: ExpiryState; days: number }) {
  const text =
    state === "EXPIRED"
      ? days === 0
        ? "Expires today"
        : `Expired ${-days} days ago`
      : state === "SOON"
        ? `${days} days left`
        : EXPIRY_LABEL.OK;
  return <Tag color={EXPIRY_COLOR[state]}>{text}</Tag>;
}

// ─── List ───────────────────────────────────────────────────────────────────

export function PassportListPage({
  data,
  params,
  filters,
  statuses,
  canCreate,
  embedded,
  newHref,
}: {
  data: PassportList;
  params: ListParams;
  filters: { expiry?: string; statusId?: string };
  statuses: FieldOption[];
  canCreate: boolean;
  /** Inside a client profile: no header, no filters but expiry. */
  embedded?: boolean;
  /** Embedded: where "Add passport" goes (e.g. with the client preselected). */
  newHref?: string;
}) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);
  const columns: TableColumnsType<PassportRow> = [
    {
      title: "Passport",
      key: "no",
      render: (_, r) => (
        <>
          <Link href={`/passports/${r.id}`}>{r.passportNo}</Link>
          {!r.isActive && <Tag style={{ marginLeft: 6 }}>Inactive</Tag>}
          {r.scans > 0 && <PaperClipOutlined style={{ marginLeft: 6, color: "#888" }} />}
        </>
      ),
    },
    { title: "Name", dataIndex: "name", key: "name" },
    ...(embedded
      ? []
      : [
          {
            title: "Client",
            key: "client",
            render: (_: unknown, r: PassportRow) =>
              r.clientId ? <Link href={`/clients/${r.clientId}`}>{r.clientName}</Link> : "-",
          },
        ]),
    { title: "Phone", dataIndex: "phone", key: "phone", render: (v: string | null) => v ?? "-" },
    {
      title: "Expiry",
      key: "exp",
      render: (_, r) => (
        <Space size={4} wrap>
          {formatDate(r.expiryDate)}
          {r.expiry !== "OK" && <ExpiryTag state={r.expiry} days={r.daysLeft} />}
        </Space>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => (
        <>
          {r.status ?? "-"}
          {r.withUs && (
            <Tag color="blue" style={{ marginLeft: 6 }}>
              With us
            </Tag>
          )}
        </>
      ),
    },
  ];
  return (
    <>
      {!embedded && (
        <PageHeader
          title="Passport List"
          description="Passports held or tracked for clients. Anything expiring within 6 months is flagged."
          extra={
            canCreate && (
              <Link href="/passports/new">
                <Button type="primary" icon={<PlusOutlined />}>
                  Add passport
                </Button>
              </Link>
            )
          }
        />
      )}
      <Card>
        <Flex gap={12} wrap style={{ marginBottom: 12 }}>
          {embedded && canCreate && newHref && (
            <Link href={newHref}>
              <Button icon={<PlusOutlined />}>Add passport</Button>
            </Link>
          )}
          {!embedded && (
            <Input.Search
              allowClear
              placeholder="Passport no., name, phone or client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={(v) => setParams({ q: v })}
              style={{ width: 300 }}
            />
          )}
          <Select
            style={{ width: 170 }}
            value={filters.expiry ?? ""}
            onChange={(v) => setParams({ expiry: v })}
            options={[
              { value: "", label: "Any expiry" },
              { value: "EXPIRED", label: "Expired" },
              { value: "SOON", label: "Expiring in 6 months" },
              { value: "OK", label: "Valid" },
            ]}
            aria-label="Expiry"
          />
          {!embedded && (
            <>
              <Select
                allowClear
                placeholder="Any status"
                style={{ width: 170 }}
                value={filters.statusId}
                onChange={(v) => setParams({ statusId: v ?? "" })}
                options={statuses}
                aria-label="Passport status"
              />
              <Select
                style={{ width: 130 }}
                value={params.status}
                onChange={(v) => setParams({ status: v })}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "all", label: "All" },
                ]}
                aria-label="Active"
              />
            </>
          )}
        </Flex>
        <DataTable<PassportRow>
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

const DATES = ["dateOfBirth", "issueDate", "expiryDate", "receivedDate", "returnedDate"] as const;

export function PassportForm({
  passportId,
  passportNo,
  initial,
  statuses,
  clientId,
}: {
  passportId?: string;
  passportNo?: string;
  initial?: Record<string, unknown>;
  statuses: FieldOption[];
  clientId?: string;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<import("antd").UploadFile[]>([]);

  const initialValues = initial
    ? {
        ...initial,
        ...Object.fromEntries(
          DATES.map((k) => [k, initial[k] ? dayjs(initial[k] as string) : null]),
        ),
      }
    : { nationality: "Bangladeshi", clientId: clientId ?? null };

  function submit() {
    form
      .validateFields()
      .then((v: Record<string, unknown>) => {
        const payload = { ...v };
        for (const k of DATES) payload[k] = v[k] ? (v[k] as Dayjs).format("YYYY-MM-DD") : null;
        startTransition(async () => {
          const r = await savePassportAction(passportId ?? null, payload);
          if (!applyActionResult(r, form, message)) return;
          if (!r.ok) return;
          const id = r.data.id;
          for (const f of files) {
            if (!f.originFileObj) continue;
            const body = new FormData();
            body.append("file", f.originFileObj);
            const res = await fetch(`/api/attachments?passportId=${id}`, { method: "POST", body });
            if (!res.ok)
              message.warning(
                `${f.name}: ${((await res.json().catch(() => ({}))) as { error?: string }).error ?? "upload failed"}`,
              );
          }
          message.success("Passport saved");
          router.push(`/passports/${id}`);
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  const upper = { textTransform: "uppercase" as const };
  const dateItem = (name: string, label: string, required = false) => (
    <Form.Item
      label={label}
      name={name}
      rules={required ? [{ required: true, message: "Required" }] : []}
    >
      <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
    </Form.Item>
  );

  return (
    <>
      <PageHeader title={passportId ? `Edit passport ${passportNo}` : "Add Passport"} />
      <Form
        form={form}
        name="passport"
        layout="vertical"
        requiredMark="optional"
        initialValues={initialValues}
      >
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={12} md={6} xl={4}>
              <Form.Item
                label="Passport no."
                name="passportNo"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input maxLength={20} style={upper} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Full name (as in passport)"
                name="name"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input maxLength={120} style={upper} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item label="Client" name="clientId">
                <PartySelect party="clients" id="passport_clientId" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Phone" name="phone">
                <Input maxLength={30} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Gender" name="gender">
                <Select
                  allowClear
                  options={[
                    { value: "MALE", label: "Male" },
                    { value: "FEMALE", label: "Female" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              {dateItem("dateOfBirth", "Date of birth")}
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Nationality" name="nationality">
                <Input maxLength={60} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Place of issue" name="placeOfIssue">
                <Input maxLength={80} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              {dateItem("issueDate", "Issue date")}
            </Col>
            <Col xs={12} md={6} xl={4}>
              {dateItem("expiryDate", "Expiry date", true)}
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Status" name="statusId">
                <Select
                  allowClear
                  options={statuses}
                  notFoundContent={<Link href="/settings/passportstatus">Add statuses</Link>}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              {dateItem("receivedDate", "Received by us")}
            </Col>
            <Col xs={12} md={6} xl={4}>
              {dateItem("returnedDate", "Returned to client")}
            </Col>
            <Col xs={24} xl={12}>
              <Form.Item label="Note" name="note">
                <Input maxLength={500} />
              </Form.Item>
            </Col>
            <Col xs={24} xl={12}>
              <Form.Item label="Scans (PDF or image, up to 2 MB each)">
                <Upload
                  fileList={files}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setFiles(fileList.slice(-4))}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                >
                  <Button icon={<UploadOutlined />}>Attach scan</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
        </Card>
        <Flex gap={8} justify="flex-end" style={{ marginBottom: 24 }}>
          <Link href={passportId ? `/passports/${passportId}` : "/passports"}>
            <Button>Cancel</Button>
          </Link>
          <Button type="primary" loading={pending} onClick={submit}>
            Save passport
          </Button>
        </Flex>
      </Form>
    </>
  );
}

// ─── View ───────────────────────────────────────────────────────────────────

export function PassportDetail({
  passport: p,
  statuses,
  canEdit,
}: {
  passport: PassportView;
  statuses: FieldOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [statusOpen, setStatusOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ statusId: string; note?: string }>();
  const d = (v: string | null) => (v ? formatDate(v) : "-");

  async function changeStatus() {
    const v = await form.validateFields();
    setSaving(true);
    const r = await changePassportStatusAction(p.id, v);
    setSaving(false);
    if (applyActionResult(r, form, message, "Status changed")) {
      setStatusOpen(false);
      router.refresh();
    }
  }

  async function uploadScan(file: File) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/attachments?passportId=${p.id}`, { method: "POST", body });
    if (res.ok) {
      message.success("Scan attached");
      router.refresh();
    } else
      message.error(
        ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed",
      );
    return false;
  }

  async function toggleActive() {
    const r = await setPassportActiveAction(p.id, !p.isActive);
    if (applyActionResult(r, null, message, p.isActive ? "Deactivated" : "Activated"))
      router.refresh();
  }

  return (
    <>
      <Link href="/passports" style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> Passport list
      </Link>
      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" wrap gap={16}>
          <Space direction="vertical" size={2}>
            <Space wrap>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {p.passportNo}
              </Typography.Title>
              <ExpiryTag state={p.expiry} days={p.daysLeft} />
              {p.status && <Tag>{p.status.name}</Tag>}
              {!p.isActive && <Tag>Inactive</Tag>}
            </Space>
            <Typography.Text strong>{p.name}</Typography.Text>
            {p.client && (
              <Typography.Text>
                Client: <Link href={`/clients/${p.client.id}`}>{p.client.name}</Link>
              </Typography.Text>
            )}
          </Space>
          {canEdit && (
            <Space wrap>
              <Button
                onClick={() => {
                  form.setFieldsValue({ statusId: p.status?.id, note: "" });
                  setStatusOpen(true);
                }}
              >
                Change status
              </Button>
              <Upload
                showUploadList={false}
                beforeUpload={uploadScan}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
              >
                <Button icon={<UploadOutlined />}>Attach scan</Button>
              </Upload>
              <Link href={`/passports/${p.id}/edit`}>
                <Button icon={<EditOutlined />}>Edit</Button>
              </Link>
              <Button onClick={toggleActive}>{p.isActive ? "Deactivate" : "Activate"}</Button>
            </Space>
          )}
        </Flex>
      </Card>
      <Row gutter={16}>
        <Col xs={24} xl={14}>
          <Card title="Details" style={{ marginBottom: 16 }}>
            <Descriptions
              size="small"
              column={{ xs: 1, md: 2 }}
              items={[
                { key: "exp", label: "Expiry date", children: d(p.expiryDate) },
                { key: "iss", label: "Issue date", children: d(p.issueDate) },
                { key: "place", label: "Place of issue", children: p.placeOfIssue ?? "-" },
                { key: "nat", label: "Nationality", children: p.nationality },
                { key: "dob", label: "Date of birth", children: d(p.dateOfBirth) },
                {
                  key: "g",
                  label: "Gender",
                  children: p.gender ? (p.gender === "MALE" ? "Male" : "Female") : "-",
                },
                { key: "ph", label: "Phone", children: p.phone ?? "-" },
                { key: "rec", label: "Received by us", children: d(p.receivedDate) },
                { key: "ret", label: "Returned to client", children: d(p.returnedDate) },
                ...(p.note ? [{ key: "n", label: "Note", children: p.note, span: 2 }] : []),
              ]}
            />
          </Card>
          <Card title="Scans" style={{ marginBottom: 16 }}>
            {p.attachments.length === 0 ? (
              <Typography.Text type="secondary">No scans yet.</Typography.Text>
            ) : (
              <Space direction="vertical">
                {p.attachments.map((a) => (
                  <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                    <PaperClipOutlined /> {a.fileName} ({Math.ceil(a.size / 1024)} KB)
                  </a>
                ))}
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Status history" style={{ marginBottom: 16 }}>
            {p.statusHistory.length === 0 ? (
              <Typography.Text type="secondary">No status set yet.</Typography.Text>
            ) : (
              <Timeline
                items={[...p.statusHistory].reverse().map((h, i) => ({
                  key: i,
                  children: (
                    <>
                      <Typography.Text strong>{h.status}</Typography.Text>{" "}
                      <Typography.Text type="secondary">
                        {new Date(h.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
                      </Typography.Text>
                      {h.note && <div style={{ color: "#888" }}>{h.note}</div>}
                    </>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>
      <Modal
        open={statusOpen}
        title="Change status"
        okText="Save"
        okButtonProps={{ loading: saving }}
        onOk={changeStatus}
        onCancel={() => setStatusOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            label="Status"
            name="statusId"
            rules={[{ required: true, message: "Choose the status" }]}
          >
            <Select options={statuses} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
