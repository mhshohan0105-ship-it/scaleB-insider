"use client";

import { Col, DatePicker, Form, Input } from "antd";
import type { Dayjs } from "dayjs";

/** Cheque number, bank and date; shown only when the method is Cheque. */
export function ChequeFields() {
  return (
    <Form.Item noStyle shouldUpdate={(a, b) => a.paymentMethod !== b.paymentMethod}>
      {({ getFieldValue }) =>
        getFieldValue("paymentMethod") === "CHEQUE" ? (
          <>
            <Col span={12}>
              <Form.Item
                label="Cheque no."
                name={["cheque", "chequeNo"]}
                rules={[{ required: true, message: "Required" }]}
              >
                <Input maxLength={30} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Cheque date"
                name={["cheque", "chequeDate"]}
                rules={[{ required: true, message: "Required" }]}
              >
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="Bank (on the cheque)"
                name={["cheque", "bankName"]}
                rules={[{ required: true, message: "Required" }]}
                extra="The money reaches the account above when the cheque clears (Cheque Management)."
              >
                <Input maxLength={80} />
              </Form.Item>
            </Col>
          </>
        ) : null
      }
    </Form.Item>
  );
}

/** Turns the cheque date picker value into "YYYY-MM-DD" (or drops the cheque). */
export function withChequeDate<T extends Record<string, unknown>>(values: T): T {
  const cheque = values.cheque as { chequeDate?: Dayjs | null } | undefined;
  if (values.paymentMethod !== "CHEQUE" || !cheque) return { ...values, cheque: null };
  return {
    ...values,
    cheque: {
      ...cheque,
      chequeDate: cheque.chequeDate ? cheque.chequeDate.format("YYYY-MM-DD") : null,
    },
  };
}
