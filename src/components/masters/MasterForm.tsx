"use client";

import { useEffect } from "react";
import { App, DatePicker, Form, Input, InputNumber, Modal, Select, Switch } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { FieldDef, FieldOption, MasterDef } from "@/lib/masters";
import type { MasterRow } from "@/server/services/masters/masterService";
import { MoneyInput } from "@/components/MoneyInput";
import { EntitySelect } from "@/components/select/EntitySelect";
import { saveEntityAction } from "@/app/(app)/entityActions";

interface MasterFormProps {
  def: MasterDef;
  open: boolean;
  editing: MasterRow | null;
  /** Options for ref fields; a ref field without them searches on the server. */
  refOptions?: Record<string, FieldOption[]>;
  /** Starting values for a new row (e.g. the name typed into a picker). */
  prefill?: Record<string, string>;
  onClose: () => void;
  onSaved: (id: string) => void;
}

type FormValues = Record<string, unknown>;

function initialValues(
  def: MasterDef,
  row: MasterRow | null,
  prefill?: Record<string, string>,
): FormValues {
  const values: FormValues = {};
  for (const f of def.fields) {
    const v = row ? row[f.name] : (prefill?.[f.name] ?? f.defaultValue);
    values[f.name] = f.type === "date" && v ? dayjs(v as string) : (v ?? undefined);
  }
  return values;
}

function toPayload(def: MasterDef, values: FormValues): FormValues {
  const out: FormValues = {};
  for (const f of def.fields) {
    const v = values[f.name];
    out[f.name] = f.type === "date" && v ? (v as Dayjs).startOf("day").toISOString() : (v ?? null);
  }
  return out;
}

function renderInput(f: FieldDef, refOptions?: Record<string, FieldOption[]>) {
  switch (f.type) {
    case "textarea":
      return <Input.TextArea rows={3} maxLength={f.max} showCount={!!f.max && f.max > 200} />;
    case "email":
      return <Input type="email" maxLength={120} />;
    case "code":
      return (
        <Input
          maxLength={f.max}
          style={{ textTransform: "uppercase" }}
          placeholder={f.placeholder}
        />
      );
    case "int":
      return <InputNumber precision={0} min={f.min} max={f.max} style={{ width: "100%" }} />;
    case "money":
      return <MoneyInput />;
    case "percent":
      return <MoneyInput precision={4} max="100" suffix="%" />;
    case "select":
      return (
        <Select
          allowClear={!f.required}
          placeholder={f.placeholder}
          options={f.options?.map((o) => ({ value: o.value, label: o.label }))}
        />
      );
    case "ref":
      if (!refOptions?.[f.name] && f.ref)
        return (
          <EntitySelect
            entity={f.ref}
            allowClear={!f.required}
            placeholder={f.placeholder ?? `Select ${f.label.toLowerCase()}`}
          />
        );
      return (
        <Select
          showSearch
          allowClear={!f.required}
          optionFilterProp="label"
          placeholder={f.placeholder ?? `Select ${f.label.toLowerCase()}`}
          options={refOptions?.[f.name] ?? []}
        />
      );
    case "date":
      return <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />;
    case "bool":
      return <Switch />;
    default:
      return <Input maxLength={f.max} placeholder={f.placeholder} />;
  }
}

export function MasterForm({
  def,
  open,
  editing,
  refOptions,
  prefill,
  onClose,
  onSaved,
}: MasterFormProps) {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(
        initialValues(def, editing, prefill) as Parameters<typeof form.setFieldsValue>[0],
      );
    }
  }, [open, editing, def, form, prefill]);

  async function submit() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return; // the form shows what is missing
    const result = await saveEntityAction(def.key, editing?.id ?? null, toPayload(def, values));
    if (!result.ok) {
      if (result.fieldErrors) {
        form.setFields(
          Object.entries(result.fieldErrors).map(([name, err]) => ({ name, errors: [err] })),
        );
      }
      message.error(result.error);
      return;
    }
    message.success(editing ? `${def.singular} updated` : `${def.singular} added`);
    onSaved(result.data.id);
  }

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${def.singular}` : `Add ${def.singular}`}
      okText={editing ? "Save changes" : "Add"}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
      width={def.fields.length > 5 ? 720 : 520}
    >
      <Form form={form} layout="vertical" requiredMark="optional" preserve={false}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: def.fields.length > 5 ? "repeat(2, minmax(0, 1fr))" : "1fr",
            columnGap: 16,
          }}
        >
          {def.fields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              extra={f.help}
              valuePropName={f.type === "bool" ? "checked" : "value"}
              rules={
                f.required && f.type !== "bool"
                  ? [{ required: true, message: `${f.label} is required` }]
                  : []
              }
              style={
                f.type === "textarea" && def.fields.length > 5
                  ? { gridColumn: "1 / -1" }
                  : undefined
              }
            >
              {renderInput(f, refOptions)}
            </Form.Item>
          ))}
        </div>
      </Form>
    </Modal>
  );
}
