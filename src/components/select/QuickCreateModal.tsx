"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Col, Form, Input, Modal, Row, Select } from "antd";
import { ENTITIES } from "@/lib/entities";
import type { EntityKey } from "@/lib/masters";
import { CLIENT_TYPE_OPTIONS } from "@/lib/parties";
import { MasterForm } from "@/components/masters/MasterForm";
import { saveExpenseHeadAction, saveLoanAuthorityAction } from "@/app/(app)/vouchers/actions";
import { MoneyAccountModal } from "@/components/accounts/MoneyAccountModal";
import { applyActionResult } from "@/components/formResult";
import {
  findClientByPhoneAction,
  quickCreateClientAction,
  searchEntityAction,
} from "@/app/(app)/entityActions";
import type { CreatableKey, PickOption } from "./EntitySelect";

interface Props {
  entity: CreatableKey;
  open: boolean;
  /** Text typed into the picker before "+ Add", used to prefill the form. */
  typed: string;
  onClose: () => void;
  onCreated: (option: PickOption) => void;
}

const looksLikePhone = (s: string) => /^\+?[\d\s-]{6,}$/.test(s);

/** The pop-up behind a picker's "+ Add new ...": the same form as the list's own page. */
export function QuickCreateModal({ entity, open, typed, onClose, onCreated }: Props) {
  if (entity === "moneyaccounts")
    return (
      <MoneyAccountModal
        open={open}
        editing={null}
        initialName={typed}
        onClose={onClose}
        onSaved={(a) => onCreated({ value: a.id, label: a.name, kind: a.kind })}
      />
    );
  if (entity === "expenseheads" || entity === "loanauthorities")
    return (
      <NamedRowModal
        kind={entity}
        open={open}
        typed={typed}
        onClose={onClose}
        onCreated={onCreated}
      />
    );
  if (entity === "clients")
    return <QuickClientModal open={open} typed={typed} onClose={onClose} onCreated={onCreated} />;
  return (
    <QuickMasterModal
      entity={entity}
      open={open}
      typed={typed}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

/** The picker's label for a row just saved (code, IATA prefix, ...). */
async function optionFor(entity: EntityKey, id: string, fallback: string): Promise<PickOption> {
  const r = await searchEntityAction(entity, "", id);
  return (r.ok && r.data.find((o) => o.value === id)) || { value: id, label: fallback };
}

function QuickMasterModal({
  entity,
  open,
  typed,
  onClose,
  onCreated,
}: Omit<Props, "entity"> & { entity: EntityKey }) {
  const def = ENTITIES[entity];
  const prefill = useMemo((): Record<string, string> | undefined => {
    if (!typed) return undefined;
    // "BS" or "DAC" typed into an airline or airport picker is its code.
    const hasCode = def.fields.some((f) => f.name === "iata");
    return hasCode && /^[A-Za-z0-9]{2,3}$/.test(typed)
      ? { iata: typed.toUpperCase() }
      : { name: typed };
  }, [def, typed]);

  return (
    <MasterForm
      def={def}
      open={open}
      editing={null}
      prefill={prefill}
      onClose={onClose}
      onSaved={async (id) => onCreated(await optionFor(entity, id, typed || def.singular))}
    />
  );
}

interface ClientValues {
  newClient: {
    name: string;
    phone: string;
    type: string;
    email?: string;
    address?: string;
  };
}

/** A new client with just what an invoice needs; the full profile can wait. */
function QuickClientModal({ open, typed, onClose, onCreated }: Omit<Props, "entity">) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ClientValues>();
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<PickOption | null>(null);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setExisting(null);
    const t = typed.trim();
    form.setFieldsValue({
      newClient: {
        type: "INDIVIDUAL",
        ...(t ? (looksLikePhone(t) ? { phone: t } : { name: t }) : {}),
      },
    } as Partial<ClientValues>);
  }, [open, typed, form]);

  async function checkPhone() {
    const phone = form.getFieldValue(["newClient", "phone"]) as string | undefined;
    if (!phone) return setExisting(null);
    const r = await findClientByPhoneAction(phone);
    setExisting(r.ok ? r.data : null);
  }

  async function save() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return; // the form shows what is missing
    setSaving(true);
    const result = await quickCreateClientAction(values.newClient);
    setSaving(false);
    if (applyActionResult(result, form, message, "Client added")) {
      const name = values.newClient.name.trim();
      onCreated(await optionFor("clients", result.data.id, name));
    }
  }

  return (
    <Modal
      open={open}
      title="Add Client"
      okText="Add"
      confirmLoading={saving}
      onOk={save}
      onCancel={onClose}
      forceRender
      width={620}
    >
      <Form form={form} name="quickClient" layout="vertical" requiredMark="optional">
        <Row gutter={16}>
          <Col xs={24} md={14}>
            <Form.Item
              label="Client name"
              name={["newClient", "name"]}
              rules={[{ required: true, min: 2, message: "Client name is required" }]}
            >
              <Input maxLength={120} placeholder="Full name or company" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item label="Type" name={["newClient", "type"]}>
              <Select options={[...CLIENT_TYPE_OPTIONS]} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Mobile"
              name={["newClient", "phone"]}
              rules={[
                { required: true, message: "Mobile number is required" },
                { pattern: /^(\+?88)?01[3-9]\d{8}$/, message: "Like 01XXXXXXXXX" },
              ]}
            >
              <Input maxLength={14} placeholder="01XXXXXXXXX" inputMode="tel" onBlur={checkPhone} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Email"
              name={["newClient", "email"]}
              rules={[{ type: "email", message: "Enter a valid email" }]}
            >
              <Input maxLength={120} placeholder="Optional" />
            </Form.Item>
          </Col>
          {existing && (
            <Col span={24}>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`This mobile number belongs to ${existing.label}.`}
                action={
                  <Button size="small" type="primary" onClick={() => onCreated(existing)}>
                    Use this client
                  </Button>
                }
              />
            </Col>
          )}
          <Col span={24}>
            <Form.Item label="Address" name={["newClient", "address"]}>
              <Input maxLength={300} placeholder="Optional" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

const AUTHORITY_TYPES = [
  { value: "BANK", label: "Bank" },
  { value: "PERSON", label: "Person" },
  { value: "COMPANY", label: "Company" },
];

/** Expense heads and loan authorities: a name and a few details. */
function NamedRowModal({
  kind,
  open,
  typed,
  onClose,
  onCreated,
}: Omit<Props, "entity"> & { kind: "expenseheads" | "loanauthorities" }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Record<string, string>>();
  const [saving, setSaving] = useState(false);
  const authority = kind === "loanauthorities";

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ name: typed.trim(), ...(authority ? { type: "BANK" } : {}) });
  }, [open, typed, authority, form]);

  async function save() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return; // the form shows what is missing
    setSaving(true);
    const result = authority
      ? await saveLoanAuthorityAction(null, values)
      : await saveExpenseHeadAction(null, values);
    setSaving(false);
    if (
      applyActionResult(result, form, message, authority ? "Authority added" : "Expense head added")
    )
      onCreated({ value: result.data.id, label: values.name!.trim() });
  }

  return (
    <Modal
      open={open}
      title={authority ? "Add authority" : "Add expense head"}
      okText="Add"
      confirmLoading={saving}
      onOk={save}
      onCancel={onClose}
      forceRender
    >
      <Form form={form} name={`quick_${kind}`} layout="vertical" requiredMark="optional">
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, min: 2, message: "Name is required" }]}
        >
          <Input maxLength={authority ? 120 : 80} />
        </Form.Item>
        {authority && (
          <>
            <Form.Item label="Type" name="type">
              <Select options={AUTHORITY_TYPES} />
            </Form.Item>
            <Form.Item label="Phone" name="phone">
              <Input maxLength={30} />
            </Form.Item>
            <Form.Item label="Address" name="address">
              <Input maxLength={300} />
            </Form.Item>
          </>
        )}
        <Form.Item label="Note" name="note">
          <Input maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
