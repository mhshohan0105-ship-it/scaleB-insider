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
  Flex,
  Form,
  Input,
  Result,
  Row,
  Select,
  Space,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { PilgrimOption, RefundableHajjInvoice } from "@/server/services/hajj/pilgrimService";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { cancelPilgrimAction } from "@/app/(app)/hajj/actions";

interface Props {
  stage: "PRE_REG" | "REG";
  today: string;
  /** Pilgrims this cancel applies to (not yet registered / registered). */
  pilgrims: PilgrimOption[];
  initialPilgrimId?: string;
  canRefund: boolean;
}

interface Values {
  pilgrimId?: string;
  date?: Dayjs;
  reason?: string;
}

/**
 * Cancels a pre registration or registration, then offers the refund of the
 * pilgrim's invoices (the "refund wizard" step of PLAN.md 6.17).
 */
export function CancelForm({ stage, today, pilgrims, initialPilgrimId, canRefund }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{
    pilgrimId: string;
    name: string;
    invoices: RefundableHajjInvoice[];
  } | null>(null);
  const what = stage === "PRE_REG" ? "pre registration" : "registration";

  function submit() {
    form
      .validateFields()
      .then((v) => {
        startTransition(async () => {
          const result = await cancelPilgrimAction(stage, {
            ...v,
            date: v.date?.format("YYYY-MM-DD"),
          });
          if (!applyActionResult(result, form, message)) return;
          if (!result.ok) return;
          const p = pilgrims.find((x) => x.value === v.pilgrimId);
          setDone({
            pilgrimId: v.pilgrimId!,
            name: p?.label.split(" · ")[0] ?? "Pilgrim",
            invoices: (result.data as { invoices: RefundableHajjInvoice[] }).invoices,
          });
          form.resetFields();
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  if (done) {
    return (
      <Result
        status="success"
        title={`${done.name}: ${what} cancelled`}
        subTitle={
          done.invoices.length
            ? "Refund what the pilgrim paid now, or later from the Refund menu."
            : "This pilgrim is not on any posted invoice, so there is nothing to refund."
        }
        extra={
          <Space wrap>
            {canRefund &&
              done.invoices.map((i) => (
                <Link key={i.id} href={`/refunds/otherpackagehajj/new?invoice=${i.id}`}>
                  <Button type="primary">Refund {i.number}</Button>
                </Link>
              ))}
            <Link href={`/hajj/pilgrims/${done.pilgrimId}`}>
              <Button>Open pilgrim</Button>
            </Link>
            <Button onClick={() => setDone(null)}>Cancel another</Button>
          </Space>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Cancel ${stage === "PRE_REG" ? "Pre Registration" : "Registration"}`}
        description={
          stage === "PRE_REG"
            ? "For pilgrims who are pre registered but not registered yet."
            : "For registered pilgrims. Their record stays, marked cancelled."
        }
      />
      <Form<Values>
        form={form}
        name="cancelPilgrim"
        layout="vertical"
        requiredMark="optional"
        initialValues={{ date: dayjs(today), pilgrimId: initialPilgrimId }}
      >
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} xl={12}>
              <Form.Item
                label="Pilgrim"
                name="pilgrimId"
                rules={[{ required: true, message: "Choose the pilgrim" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={pilgrims}
                  placeholder="Name, passport or tracking no."
                  notFoundContent={`No pilgrims whose ${what} can be cancelled`}
                />
              </Form.Item>
            </Col>
            <Col xs={12} xl={4}>
              <Form.Item
                label="Cancel date"
                name="date"
                rules={[{ required: true, message: "Required" }]}
              >
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                label="Reason"
                name="reason"
                rules={[{ required: true, min: 3, message: "Give a reason" }]}
              >
                <Input.TextArea rows={2} maxLength={300} />
              </Form.Item>
            </Col>
          </Row>
        </Card>
        <Flex justify="flex-end" style={{ marginBottom: 24 }}>
          <Button danger type="primary" loading={pending} onClick={submit}>
            Cancel {what}
          </Button>
        </Flex>
      </Form>
    </>
  );
}
