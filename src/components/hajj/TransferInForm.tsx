"use client";

import { useTransition } from "react";
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
  InputNumber,
  Row,
  Select,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import type { FieldOption } from "@/lib/masters";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { createTransferAction } from "@/app/(app)/hajj/actions";

interface PilgrimRowValues {
  name?: string;
  passportNo?: string | null;
  trackingNo?: string | null;
  preRegNo?: string | null;
  regNo?: string | null;
  voucherNo?: string | null;
  phone?: string | null;
}

interface Values {
  agency?: string;
  clientId?: string;
  hajjYear?: number;
  groupId?: string | null;
  moallem?: string | null;
  date?: Dayjs;
  chargePerPilgrim?: string | null;
  note?: string | null;
  pilgrims?: PilgrimRowValues[];
}

/** Pilgrims arriving from another agency: creates their records. */
export function TransferInForm({ today, groups }: { today: string; groups: FieldOption[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [pending, startTransition] = useTransition();
  const upper = { textTransform: "uppercase" as const };

  function submit() {
    form
      .validateFields()
      .then((v) => {
        startTransition(async () => {
          const result = await createTransferAction("IN", {
            ...v,
            date: v.date?.format("YYYY-MM-DD"),
          });
          if (!applyActionResult(result, form, message)) return;
          if (!result.ok) return;
          message.success(`${(result.data as { number: string }).number} saved`);
          form.resetFields();
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  return (
    <>
      <PageHeader
        title="Transfer In"
        description="Pilgrims handed over to you by another agency. Their records are created here as transferred in."
      />
      <Form<Values>
        form={form}
        name="transferIn"
        layout="vertical"
        requiredMark="optional"
        initialValues={{ date: dayjs(today), hajjYear: Number(today.slice(0, 4)), pilgrims: [{}] }}
      >
        <Card title="Transfer" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="From agency"
                name="agency"
                rules={[{ required: true, message: "Enter the agency" }]}
              >
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Paying client"
                name="clientId"
                rules={[{ required: true, message: "Choose the client who pays" }]}
              >
                <PartySelect party="clients" id="transferIn_clientId" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item
                label="Hajj year"
                name="hajjYear"
                rules={[{ required: true, message: "Required" }]}
              >
                <InputNumber min={2000} max={2100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Date" name="date" rules={[{ required: true, message: "Required" }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={6}>
              <Form.Item label="Group" name="groupId">
                <Select allowClear showSearch optionFilterProp="label" options={groups} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={6}>
              <Form.Item label="Moallem" name="moallem">
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Charge per pilgrim" name="chargePerPilgrim">
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

        <Card title="Pilgrims" style={{ marginBottom: 16 }}>
          <Form.List name="pilgrims">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Row key={field.key} gutter={10} align="bottom" className="line-row">
                    <Col xs={24} md={8} xl={5}>
                      <Form.Item
                        label="Name"
                        name={[field.name, "name"]}
                        rules={[{ required: true, message: "Required" }]}
                      >
                        <Input maxLength={120} style={upper} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4} xl={3}>
                      <Form.Item label="Passport no." name={[field.name, "passportNo"]}>
                        <Input maxLength={20} style={upper} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4} xl={3}>
                      <Form.Item label="Tracking no." name={[field.name, "trackingNo"]}>
                        <Input maxLength={30} style={upper} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4} xl={3}>
                      <Form.Item label="Pre reg. no." name={[field.name, "preRegNo"]}>
                        <Input maxLength={30} style={upper} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4} xl={3}>
                      <Form.Item label="Reg. no." name={[field.name, "regNo"]}>
                        <Input maxLength={30} style={upper} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4} xl={3}>
                      <Form.Item label="Voucher no." name={[field.name, "voucherNo"]}>
                        <Input maxLength={30} style={upper} />
                      </Form.Item>
                    </Col>
                    <Col xs={10} md={4} xl={3}>
                      <Form.Item label="Phone" name={[field.name, "phone"]}>
                        <Input maxLength={30} />
                      </Form.Item>
                    </Col>
                    <Col xs={2} md={2} xl={1}>
                      <Form.Item label=" ">
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`Remove pilgrim ${index + 1}`}
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({})}>
                  Add pilgrim
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        <Flex justify="flex-end" style={{ marginBottom: 24 }}>
          <Button type="primary" loading={pending} onClick={submit}>
            Save transfer in
          </Button>
        </Flex>
      </Form>
    </>
  );
}
