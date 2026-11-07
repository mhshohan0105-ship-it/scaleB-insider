"use client";

import { useEffect, useState } from "react";
import { App, Col, Form, Input, Modal, Row, Select } from "antd";
import { MONEY_ACCOUNT_KIND_OPTIONS } from "@/lib/schemas/accounts";
import type { MoneyAccountRow } from "@/server/services/accounts/moneyAccountService";
import { MoneyInput } from "@/components/MoneyInput";
import { applyActionResult } from "@/components/formResult";
import { saveMoneyAccountAction } from "@/app/(app)/accounts/actions";

interface AccountForm {
  name: string;
  kind: string;
  bankName?: string | null;
  accountNo?: string | null;
  branch?: string | null;
  openingBalance: string;
  note?: string | null;
}

/** Add or edit a cash, bank, mobile banking or card account. */
export function MoneyAccountModal({
  open,
  editing,
  initialName,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Account being edited; null adds a new one. */
  editing: MoneyAccountRow | null;
  /** Prefills the name of a new account (typed into a picker). */
  initialName?: string;
  onClose: () => void;
  onSaved: (account: { id: string; name: string; kind: string }) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<AccountForm>();
  const [saving, setSaving] = useState(false);
  const kind = Form.useWatch("kind", form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      editing
        ? { ...editing, accountNo: "" }
        : { kind: "BANK", openingBalance: "0", name: initialName ?? undefined },
    );
  }, [open, editing, initialName, form]);

  async function save() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return; // the form shows what is missing
    setSaving(true);
    const result = await saveMoneyAccountAction(editing?.id ?? null, values);
    setSaving(false);
    if (applyActionResult(result, form, message, editing ? "Account updated" : "Account added")) {
      onSaved({ id: result.data.id, name: values.name.trim(), kind: values.kind });
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${editing.name}` : "Add Account"}
      okText={editing ? "Save changes" : "Add"}
      confirmLoading={saving}
      onOk={save}
      onCancel={onClose}
      forceRender
    >
      <Form form={form} name="moneyAccount" layout="vertical" requiredMark="optional">
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              label="Account name"
              name="name"
              rules={[{ required: true, message: "Account name is required" }]}
            >
              <Input maxLength={80} placeholder="e.g. City Bank Current" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item label="Type" name="kind" rules={[{ required: true }]}>
              <Select options={[...MONEY_ACCOUNT_KIND_OPTIONS]} />
            </Form.Item>
          </Col>
          {kind !== "CASH" && (
            <>
              <Col span={12}>
                <Form.Item label={kind === "MOBILE_BANKING" ? "Provider" : "Bank"} name="bankName">
                  <Input
                    maxLength={120}
                    placeholder={kind === "MOBILE_BANKING" ? "bKash, Nagad, ..." : undefined}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Account / wallet number"
                  name="accountNo"
                  extra={
                    editing?.accountNoMasked
                      ? `Stored as ${editing.accountNoMasked}. Leave blank to keep it.`
                      : "Only the last 4 digits are stored."
                  }
                >
                  <Input maxLength={40} autoComplete="off" />
                </Form.Item>
              </Col>
              {kind === "BANK" && (
                <Col span={24}>
                  <Form.Item label="Branch" name="branch">
                    <Input maxLength={120} />
                  </Form.Item>
                </Col>
              )}
            </>
          )}
          <Col span={24}>
            <Form.Item
              label="Opening balance"
              name="openingBalance"
              rules={[{ required: true, message: "Opening balance is required" }]}
              extra="Money in this account when you started using scaleB Insider."
            >
              <MoneyInput />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Note" name="note">
              <Input.TextArea rows={2} maxLength={500} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
