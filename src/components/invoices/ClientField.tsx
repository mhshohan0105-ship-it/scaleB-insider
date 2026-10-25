"use client";

import { useEffect, useState } from "react";
import { Col, Form, Input, Row, Segmented, Select, Tag, Typography } from "antd";
import { formatMoney } from "@/lib/format";
import { PartySelect } from "@/components/PartySelect";
import { clientSnapshotAction } from "@/app/(app)/invoices/invoiceActions";

type Mode = "existing" | "new";

/**
 * Client for an invoice: pick an existing client, or type a new one that is
 * created together with the invoice (fields `clientId` / `newClient.*`).
 * Shows the chosen client's balance so the seller sees old dues at once.
 */
export function ClientField({
  formName,
  invoiceType,
  allowNew = true,
  locked = false,
}: {
  formName: string;
  invoiceType: string;
  /** Reissues belong to the original ticket's client: no new client there. */
  allowNew?: boolean;
  /** Edit of an invoice that already has money in: the client cannot change. */
  locked?: boolean;
}) {
  const form = Form.useFormInstance();
  const [mode, setMode] = useState<Mode>("existing");
  const clientId = Form.useWatch("clientId", form) as string | null | undefined;
  const [snapshot, setSnapshot] = useState<{ balance: string; dueInvoices: number } | null>(null);

  useEffect(() => {
    setSnapshot(null);
    if (!clientId || mode !== "existing") return;
    let live = true;
    void clientSnapshotAction(invoiceType, clientId).then((r) => {
      if (live && r.ok) setSnapshot(r.data);
    });
    return () => {
      live = false;
    };
  }, [clientId, mode, invoiceType]);

  function switchTo(next: Mode) {
    setMode(next);
    if (next === "new") form.setFieldValue("clientId", null);
    else form.setFieldValue("newClient", undefined);
  }

  const balance = snapshot ? Number(snapshot.balance) : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      {allowNew && !locked && (
        <Segmented<Mode>
          value={mode}
          onChange={switchTo}
          options={[
            { label: "Existing client", value: "existing" },
            { label: "New client", value: "new" },
          ]}
          style={{ marginBottom: 12 }}
        />
      )}
      {mode === "existing" ? (
        <Row gutter={16} align="bottom">
          <Col xs={24} md={14}>
            <Form.Item
              label="Client"
              name="clientId"
              rules={[{ required: true, message: "Choose a client" }]}
            >
              <PartySelect party="clients" id={`${formName}_clientId`} disabled={locked} />
            </Form.Item>
          </Col>
          {snapshot && (
            <Col xs={24} md={10}>
              <Form.Item label=" " colon={false}>
                {balance > 0 ? (
                  <Tag color="red" style={{ padding: "4px 10px", fontSize: 13 }}>
                    Owes {formatMoney(snapshot.balance)} · {snapshot.dueInvoices} unpaid invoice
                    {snapshot.dueInvoices === 1 ? "" : "s"}
                  </Tag>
                ) : balance < 0 ? (
                  <Tag color="green" style={{ padding: "4px 10px", fontSize: 13 }}>
                    Advance {formatMoney(String(-balance))}
                  </Tag>
                ) : (
                  <Typography.Text type="secondary">No balance</Typography.Text>
                )}
              </Form.Item>
            </Col>
          )}
        </Row>
      ) : (
        <div
          style={{
            padding: "16px 16px 0",
            borderRadius: 10,
            background: "#f6faf9",
            border: "1px solid #d9ebe6",
            marginBottom: 16,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Client name"
                name={["newClient", "name"]}
                rules={[{ required: true, min: 2, message: "Client name is required" }]}
              >
                <Input maxLength={120} placeholder="Full name or company" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item
                label="Mobile"
                name={["newClient", "phone"]}
                rules={[
                  { required: true, message: "Mobile number is required" },
                  { pattern: /^(\+?88)?01[3-9]\d{8}$/, message: "Like 01XXXXXXXXX" },
                ]}
              >
                <Input maxLength={14} placeholder="01XXXXXXXXX" inputMode="tel" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="Type" name={["newClient", "type"]} initialValue="INDIVIDUAL">
                <Select
                  options={[
                    { value: "INDIVIDUAL", label: "Individual" },
                    { value: "CORPORATE", label: "Corporate" },
                  ]}
                />
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
            <Col xs={24} md={12}>
              <Form.Item label="Address" name={["newClient", "address"]}>
                <Input maxLength={300} placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: -4 }}>
            The client is saved together with this invoice. If the mobile number already belongs to
            a client, you are told which one, so you can pick them instead.
          </Typography.Paragraph>
        </div>
      )}
    </div>
  );
}
