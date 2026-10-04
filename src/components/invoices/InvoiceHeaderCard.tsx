"use client";

import type { ReactNode } from "react";
import { Card, Col, DatePicker, Form, Row, Select } from "antd";
import type { FieldOption } from "@/lib/masters";
import { MoneyInput } from "@/components/MoneyInput";
import { PartySelect } from "@/components/PartySelect";

/** Client, dates, salesperson and agent fields shared by the invoice forms. */
export function InvoiceHeaderCard({
  formName,
  employees,
  extra,
}: {
  formName: string;
  employees: FieldOption[];
  /** Type specific header fields (tour group, travel dates, ...). */
  extra?: ReactNode;
}) {
  return (
    <Card title="Invoice" style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        <Col xs={24} md={12} xl={8}>
          <Form.Item
            label="Client"
            name="clientId"
            rules={[{ required: true, message: "Choose a client" }]}
          >
            <PartySelect party="clients" id={`${formName}_clientId`} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6} xl={4}>
          <Form.Item
            label="Invoice date"
            name="date"
            rules={[{ required: true, message: "Choose a date" }]}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6} xl={4}>
          <Form.Item label="Due date" name="dueDate">
            <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Form.Item label="Sold by" name="salesmanId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={employees}
              placeholder="Employee"
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Form.Item label="Referred by agent" name="agentId">
            <PartySelect party="agents" id={`${formName}_agentId`} placeholder="Optional" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6} xl={4}>
          <Form.Item label="Agent commission" name="agentCommission">
            <MoneyInput placeholder="0.00" />
          </Form.Item>
        </Col>
        {extra}
      </Row>
    </Card>
  );
}
