"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Col, Empty, Flex, Input, Row, Tag, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HubSection } from "@/lib/settingsHub";
import { PageHeader } from "@/components/PageHeader";

/** Settings home: every configuration page as a card, with a quick search. */
export function SettingsHub({
  sections,
  counts,
}: {
  sections: HubSection[];
  /** Active rows per list. */
  counts: Record<string, number>;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sections;
    return sections
      .map((s) => ({
        ...s,
        entries: s.entries.filter((e) =>
          `${e.label} ${e.description}`.toLowerCase().includes(term),
        ),
      }))
      .filter((s) => s.entries.length > 0);
  }, [sections, q]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Set up your agency and the lists used across invoices."
        extra={
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Find a setting"
            aria-label="Find a setting"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 280 }}
          />
        }
      />
      {shown.length === 0 && <Empty description="No setting matches that search" />}
      {shown.map((s) => (
        <section key={s.title} style={{ marginBottom: 24 }}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {s.title}
          </Typography.Title>
          <Row gutter={[12, 12]}>
            {s.entries.map((e) => (
              <Col key={e.href} xs={24} md={12} xl={8}>
                <Link href={e.href} style={{ display: "block", height: "100%" }}>
                  <Card hoverable size="small" style={{ height: "100%" }}>
                    <Flex justify="space-between" align="center" gap={8}>
                      <Typography.Text strong>{e.label}</Typography.Text>
                      {e.countKey && <Tag>{counts[e.countKey] ?? 0}</Tag>}
                    </Flex>
                    <Typography.Paragraph
                      type="secondary"
                      style={{ margin: "2px 0 0", fontSize: 13 }}
                    >
                      {e.description}
                    </Typography.Paragraph>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </section>
      ))}
    </>
  );
}
