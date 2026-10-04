"use client";

import { useTransition } from "react";
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
  InputNumber,
  Row,
  Select,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { FieldOption } from "@/lib/masters";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { savePilgrimAction } from "@/app/(app)/hajj/actions";

const DATE_FIELDS = ["dateOfBirth", "passportExpiry", "preRegDate"] as const;
type DateField = (typeof DATE_FIELDS)[number];

export type PilgrimFormInitial = Record<string, unknown> &
  Partial<Record<DateField, string | null>>;

interface Props {
  pilgrimId?: string;
  pilgrimName?: string;
  initial?: PilgrimFormInitial;
  defaultYear: number;
  groups: FieldOption[];
  maharams: FieldOption[];
}

export function PilgrimForm({
  pilgrimId,
  pilgrimName,
  initial,
  defaultYear,
  groups,
  maharams,
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const editing = !!pilgrimId;

  function submit() {
    form
      .validateFields()
      .then((v: Record<string, unknown>) => {
        const payload = { ...v };
        for (const k of DATE_FIELDS) {
          const d = v[k] as Dayjs | null | undefined;
          payload[k] = d ? d.format("YYYY-MM-DD") : null;
        }
        startTransition(async () => {
          const result = await savePilgrimAction(pilgrimId ?? null, payload);
          if (!applyActionResult(result, form, message)) return;
          const id = result.ok ? (result.data as { id: string }).id : pilgrimId!;
          message.success(editing ? "Pilgrim saved" : "Pilgrim added");
          router.push(`/hajj/pilgrims/${id}`);
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  const initialValues = initial
    ? {
        ...initial,
        ...Object.fromEntries(
          DATE_FIELDS.map((k) => [k, initial[k] ? dayjs(initial[k] as string) : null]),
        ),
      }
    : { hajjYear: defaultYear };

  const upper = { textTransform: "uppercase" as const };

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${pilgrimName}` : "Add Pilgrim"}
        description={
          editing
            ? "Group and moallem change through Hajji Management transfers, so their history is kept."
            : "A new pilgrim starts as pre registered. Register them once the registration number is issued."
        }
      />
      <Form
        form={form}
        name="pilgrim"
        layout="vertical"
        requiredMark="optional"
        initialValues={initialValues}
      >
        <Card title="Hajj" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Paying client"
                name="clientId"
                rules={[{ required: true, message: "Choose the client who pays" }]}
                extra="Invoices for this pilgrim are billed to this client."
              >
                <PartySelect party="clients" id="pilgrim_clientId" />
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
            {!editing && (
              <>
                <Col xs={12} md={6} xl={6}>
                  <Form.Item label="Group" name="groupId">
                    <Select allowClear showSearch optionFilterProp="label" options={groups} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12} xl={6}>
                  <Form.Item label="Moallem" name="moallem">
                    <Input maxLength={120} />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Tracking no." name="trackingNo">
                <Input maxLength={30} style={upper} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Pre registration no." name="preRegNo">
                <Input maxLength={30} style={upper} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Pre registration date" name="preRegDate">
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Personal" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Full name (as in passport)"
                name="name"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input maxLength={120} style={upper} />
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
              <Form.Item label="Date of birth" name="dateOfBirth">
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Passport no." name="passportNo">
                <Input maxLength={20} style={upper} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Passport expiry" name="passportExpiry">
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="NID no." name="nidNo">
                <Input maxLength={30} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Phone" name="phone">
                <Input maxLength={30} />
              </Form.Item>
            </Col>
            <Col xs={24} xl={16}>
              <Form.Item label="Address" name="address">
                <Input maxLength={300} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={4}>
              <Form.Item label="Maharam relation" name="maharamId">
                <Select allowClear showSearch optionFilterProp="label" options={maharams} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={8}>
              <Form.Item label="Maharam name" name="maharamName">
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Note" name="note">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Flex gap={8} justify="flex-end" style={{ marginBottom: 24 }}>
          <Link href={pilgrimId ? `/hajj/pilgrims/${pilgrimId}` : "/hajj/registration"}>
            <Button>Cancel</Button>
          </Link>
          <Button type="primary" loading={pending} onClick={submit}>
            {editing ? "Save changes" : "Add pilgrim"}
          </Button>
        </Flex>
      </Form>
    </>
  );
}
