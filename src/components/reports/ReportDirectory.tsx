"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Col, Empty, Input, Row, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { DirectorySection } from "@/lib/reports/directory";
import { PageHeader } from "@/components/PageHeader";

/** Reports home: every report as a card, in sections, with a quick search. */
export function ReportDirectory({ sections }: { sections: DirectorySection[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sections;
    return sections
      .map((s) => ({
        ...s,
        entries: s.entries.filter((e) =>
          `${s.title} ${e.label} ${e.description}`.toLowerCase().includes(term),
        ),
      }))
      .filter((s) => s.entries.length > 0);
  }, [sections, q]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Pick a report. Each one can be filtered, printed and exported to Excel."
        extra={
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Find a report"
            aria-label="Find a report"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 280 }}
          />
        }
      />
      {shown.length === 0 && <Empty description="No report matches that search" />}
      {shown.map((s) => (
        <section key={s.key} style={{ marginBottom: 24 }}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {s.title}
          </Typography.Title>
          <Row gutter={[12, 12]}>
            {s.entries.map((e) => (
              <Col key={e.key} xs={24} md={12} xl={8}>
                <Link href={e.href} style={{ display: "block", height: "100%" }}>
                  <Card hoverable size="small" style={{ height: "100%" }}>
                    <Typography.Text strong>{e.label}</Typography.Text>
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
