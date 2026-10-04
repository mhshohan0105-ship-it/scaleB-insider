"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Statistic,
  Tag,
  Timeline,
} from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { ChequeList, ChequeRow } from "@/server/services/cheques/chequeService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import { chequeAction } from "@/app/(app)/vouchers/actions";

const STATUS: Record<string, { color: string; label: string }> = {
  PENDING: { color: "blue", label: "Pending" },
  DEPOSITED: { color: "cyan", label: "Deposited" },
  CLEARED: { color: "green", label: "Cleared" },
  BOUNCED: { color: "red", label: "Bounced" },
  CANCELLED: { color: "default", label: "Cancelled" },
};

type Action = "deposit" | "clear" | "bounce";
const ACTION_TITLE: Record<Action, string> = {
  deposit: "Deposit",
  clear: "Clear",
  bounce: "Bounce",
};
const ACTION_HINT: Record<Action, string> = {
  deposit: "Marks the cheque as deposited in the bank. No money moves yet.",
  clear: "The bank has honoured the cheque: the money moves in (or out) of the account now.",
  bounce:
    "The cheque was dishonoured: its receipt / payment is voided, so the party owes (or is owed) again.",
};

interface Props {
  data: ChequeList;
  params: ListParams;
  filters: { direction?: string; chequeStatus?: string };
  canEdit: boolean;
  today: string;
}

export function ChequesPage({ data, params, filters, canEdit, today }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);
  const [acting, setActing] = useState<{ action: Action; cheque: ChequeRow } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ date: Dayjs; note?: string }>();

  function open(action: Action, cheque: ChequeRow) {
    setActing({ action, cheque });
    form.setFieldsValue({ date: dayjs(today), note: "" });
  }

  async function confirm() {
    const v = await form.validateFields();
    setSaving(true);
    const r = await chequeAction(acting!.action, acting!.cheque.id, {
      ...v,
      date: v.date.format("YYYY-MM-DD"),
    });
    setSaving(false);
    if (
      applyActionResult(
        r,
        form,
        message,
        `Cheque ${acting!.cheque.chequeNo}: ${ACTION_TITLE[acting!.action].toLowerCase()}ed`,
      )
    ) {
      setActing(null);
      router.refresh();
    }
  }

  const columns: TableColumnsType<ChequeRow> = [
    {
      title: "Cheque date",
      dataIndex: "chequeDate",
      key: "d",
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: "Cheque",
      key: "c",
      render: (_, r) => (
        <>
          {r.chequeNo}
          <div style={{ fontSize: 12, color: "#888" }}>{r.bankName}</div>
        </>
      ),
    },
    {
      title: "Direction",
      key: "dir",
      render: (_, r) =>
        r.direction === "RECEIVED" ? (
          <Tag color="green">Received</Tag>
        ) : (
          <Tag color="orange">Issued</Tag>
        ),
    },
    {
      title: "Party",
      key: "p",
      render: (_, r) => (
        <Link href={r.partyType === "CLIENT" ? `/clients/${r.partyId}` : `/vendors/${r.partyId}`}>
          {r.partyName}
        </Link>
      ),
    },
    {
      title: "Document",
      key: "doc",
      render: (_, r) =>
        r.document?.kind === "RECEIPT" ? (
          <Link href={`/moneyreceipts/${r.document.id}`}>{r.document.number}</Link>
        ) : (
          (r.document?.number ?? "-")
        ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "a",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    { title: "Bank account", dataIndex: "moneyAccount", key: "acc" },
    {
      title: "Status",
      key: "s",
      render: (_, r) => (
        <Popover
          title="History"
          content={
            <Timeline
              style={{ marginTop: 12, marginBottom: -24 }}
              items={r.history.map((h, i) => ({
                key: i,
                children: `${STATUS[h.status]?.label ?? h.status} · ${new Date(h.at).toLocaleDateString("en-GB")}${h.note ? ` · ${h.note}` : ""}`,
              }))}
            />
          }
        >
          <Tag color={STATUS[r.status]?.color} style={{ cursor: "help" }}>
            {STATUS[r.status]?.label}
          </Tag>
        </Popover>
      ),
    },
    ...(canEdit
      ? [
          {
            title: "",
            key: "act",
            render: (_: unknown, r: ChequeRow) =>
              (r.status === "PENDING" || r.status === "DEPOSITED") && (
                <Space size={4}>
                  {r.direction === "RECEIVED" && r.status === "PENDING" && (
                    <Button size="small" onClick={() => open("deposit", r)}>
                      Deposit
                    </Button>
                  )}
                  <Button size="small" type="primary" onClick={() => open("clear", r)}>
                    Clear
                  </Button>
                  <Button size="small" danger onClick={() => open("bounce", r)}>
                    Bounce
                  </Button>
                </Space>
              ),
          },
        ]
      : []),
  ];

  const inHand = data.receivedOpen;
  const issued = data.issuedOpen;

  return (
    <>
      <PageHeader
        title="Cheque Management"
        description="Cheques received with money receipts and issued with vendor payments. Money moves when a cheque clears."
      />
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={48} wrap>
          <Statistic
            title={`Received, not cleared (${inHand.count})`}
            value={formatMoney(inHand.amount)}
          />
          <Statistic
            title={`Issued, not cleared (${issued.count})`}
            value={formatMoney(issued.amount)}
          />
        </Flex>
      </Card>
      <Card>
        <Flex gap={12} wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Cheque no., bank or document"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 280 }}
          />
          <Select
            style={{ width: 150 }}
            value={filters.direction ?? ""}
            onChange={(v) => setParams({ direction: v })}
            options={[
              { value: "", label: "All cheques" },
              { value: "RECEIVED", label: "Received" },
              { value: "ISSUED", label: "Issued" },
            ]}
            aria-label="Direction"
          />
          <Select
            style={{ width: 150 }}
            value={filters.chequeStatus ?? ""}
            onChange={(v) => setParams({ chequeStatus: v })}
            options={[
              { value: "", label: "Any status" },
              ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
            ]}
            aria-label="Status"
          />
          <DateRangeFilter from={params.from} to={params.to} />
        </Flex>
        <DataTable<ChequeRow>
          rows={data.rows}
          total={data.total}
          page={params.page}
          pageSize={params.pageSize}
          columns={columns}
        />
      </Card>
      <Modal
        open={acting !== null}
        title={
          acting
            ? `${ACTION_TITLE[acting.action]} cheque ${acting.cheque.chequeNo} (${formatMoney(acting.cheque.amount)})`
            : ""
        }
        okText={acting ? ACTION_TITLE[acting.action] : "OK"}
        okButtonProps={{ loading: saving, danger: acting?.action === "bounce" }}
        onOk={confirm}
        onCancel={() => setActing(null)}
        destroyOnHidden
      >
        {acting && <p>{ACTION_HINT[acting.action]}</p>}
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item label="Date" name="date" rules={[{ required: true, message: "Required" }]}>
            <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
