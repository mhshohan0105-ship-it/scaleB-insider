"use client";

import { useEffect, useState } from "react";
import { Col, Form, Row, Tag, Typography } from "antd";
import { formatMoney } from "@/lib/format";
import { PartySelect } from "@/components/PartySelect";
import { clientSnapshotAction } from "@/app/(app)/invoices/invoiceActions";

/**
 * Client for an invoice: pick one, or add a new one from the bottom of the
 * list. Shows the chosen client's balance so the seller sees old dues at once.
 */
export function ClientField({
  formName,
  invoiceType,
  allowNew = true,
  locked = false,
}: {
  formName: string;
  invoiceType: string;
  /** Reissues belong to the original ticket's client: no "+ Add" there. */
  allowNew?: boolean;
  /** Edit of an invoice that already has money in: the client cannot change. */
  locked?: boolean;
}) {
  const form = Form.useFormInstance();
  const clientId = Form.useWatch("clientId", form) as string | null | undefined;
  const [snapshot, setSnapshot] = useState<{ balance: string; dueInvoices: number } | null>(null);

  useEffect(() => {
    setSnapshot(null);
    if (!clientId) return;
    let live = true;
    void clientSnapshotAction(invoiceType, clientId).then((r) => {
      if (live && r.ok) setSnapshot(r.data);
    });
    return () => {
      live = false;
    };
  }, [clientId, invoiceType]);

  const balance = snapshot ? Number(snapshot.balance) : 0;

  return (
    <Row gutter={16} align="bottom">
      <Col xs={24} md={14}>
        <Form.Item
          label="Client"
          name="clientId"
          rules={[{ required: true, message: "Choose a client" }]}
        >
          <PartySelect
            party="clients"
            id={`${formName}_clientId`}
            disabled={locked}
            creatable={allowNew && !locked}
          />
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
  );
}
