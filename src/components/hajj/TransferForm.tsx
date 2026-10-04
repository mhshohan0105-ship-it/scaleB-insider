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
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { d } from "@/lib/calc/money";
import { formatMoney } from "@/lib/format";
import { TRANSFER_TYPE_LABEL } from "@/lib/hajj";
import type { FieldOption } from "@/lib/masters";
import type { PilgrimOption } from "@/server/services/hajj/pilgrimService";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { createTransferAction } from "@/app/(app)/hajj/actions";

type Kind = "MOALLEM" | "GROUP" | "OUT";

const HINT: Record<Kind, string> = {
  MOALLEM: "Move pilgrims to another moallem. Their previous moallem is kept in the history.",
  GROUP: "Move pilgrims to another Hajj group.",
  OUT: "Hand pilgrims over to another agency. Refund their invoices separately if needed.",
};

interface Props {
  type: Kind;
  today: string;
  pilgrims: PilgrimOption[];
  groups: FieldOption[];
  /** Where to go after saving. */
  listPath: string;
}

interface Values {
  pilgrimIds?: string[];
  moallem?: string;
  groupId?: string;
  agency?: string;
  date?: Dayjs;
  chargePerPilgrim?: string | null;
  note?: string | null;
}

/** Moallem transfer, group transfer or transfer out. */
export function TransferForm({ type, today, pilgrims, groups, listPath }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [pending, startTransition] = useTransition();
  const [fromGroup, setFromGroup] = useState<string | undefined>();
  const [fromMoallem, setFromMoallem] = useState<string | undefined>();
  const chosen = (Form.useWatch("pilgrimIds", form) as string[] | undefined) ?? [];
  const charge = Form.useWatch("chargePerPilgrim", form) as string | undefined;

  const moallems = useMemo(
    () =>
      [...new Set(pilgrims.map((p) => p.moallem).filter((x): x is string => !!x))]
        .sort()
        .map((m) => ({ value: m, label: m })),
    [pilgrims],
  );
  const shown = pilgrims.filter(
    (p) => (!fromGroup || p.groupId === fromGroup) && (!fromMoallem || p.moallem === fromMoallem),
  );

  let total = "0.00";
  try {
    total = d(charge).times(chosen.length).toFixed(2);
  } catch {
    total = "-";
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        startTransition(async () => {
          const result = await createTransferAction(type, {
            ...v,
            date: v.date?.format("YYYY-MM-DD"),
          });
          if (!applyActionResult(result, form, message)) return;
          if (!result.ok) return;
          message.success(`${(result.data as { number: string }).number} saved`);
          form.resetFields();
          router.push(listPath);
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  return (
    <>
      <PageHeader title={TRANSFER_TYPE_LABEL[type]!} description={HINT[type]} />
      <Form<Values>
        form={form}
        name="hajjTransfer"
        layout="vertical"
        requiredMark="optional"
        initialValues={{ date: dayjs(today) }}
      >
        <Card title="Pilgrims" style={{ marginBottom: 16 }}>
          <Flex gap={12} wrap style={{ marginBottom: 12 }}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Show only group"
              style={{ width: 220 }}
              options={groups}
              value={fromGroup}
              onChange={setFromGroup}
              aria-label="Show only group"
            />
            <Select
              allowClear
              showSearch
              placeholder="Show only moallem"
              style={{ width: 220 }}
              options={moallems}
              value={fromMoallem}
              onChange={setFromMoallem}
              aria-label="Show only moallem"
            />
            <Button
              disabled={!shown.length}
              onClick={() =>
                form.setFieldValue("pilgrimIds", [
                  ...new Set([...chosen, ...shown.map((p) => p.value)]),
                ])
              }
            >
              Add all shown ({shown.length})
            </Button>
          </Flex>
          <Form.Item
            label="Pilgrims"
            name="pilgrimIds"
            rules={[{ required: true, message: "Choose at least one pilgrim" }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={shown}
              placeholder="Name, passport or tracking no."
              notFoundContent="No active pilgrims"
            />
          </Form.Item>
          <Typography.Text type="secondary">{chosen.length} chosen</Typography.Text>
        </Card>

        <Card title="Transfer" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              {type === "MOALLEM" && (
                <Form.Item
                  label="New moallem"
                  name="moallem"
                  rules={[{ required: true, message: "Enter the new moallem" }]}
                >
                  <Input maxLength={120} />
                </Form.Item>
              )}
              {type === "GROUP" && (
                <Form.Item
                  label="New group"
                  name="groupId"
                  rules={[{ required: true, message: "Choose the new group" }]}
                >
                  <Select showSearch optionFilterProp="label" options={groups} />
                </Form.Item>
              )}
              {type === "OUT" && (
                <Form.Item
                  label="To agency"
                  name="agency"
                  rules={[{ required: true, message: "Enter the agency" }]}
                >
                  <Input maxLength={120} />
                </Form.Item>
              )}
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Date" name="date" rules={[{ required: true, message: "Required" }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item
                label="Charge per pilgrim"
                name="chargePerPilgrim"
                extra={`Billed to each pilgrim's client. Total ${total === "-" ? "-" : formatMoney(total)}`}
              >
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} xl={8}>
              <Form.Item label="Note" name="note">
                <Input maxLength={500} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Flex justify="flex-end" style={{ marginBottom: 24 }}>
          <Button type="primary" loading={pending} onClick={submit}>
            Save transfer
          </Button>
        </Flex>
      </Form>
    </>
  );
}
