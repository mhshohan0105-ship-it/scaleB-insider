"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button, Card, Col, Empty, Row, Space, Statistic, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { FileExcelOutlined, FilePdfOutlined } from "@ant-design/icons";
import { formatMoney } from "@/lib/format";
import { cellText, isNumericColumn } from "@/lib/reports/format";
import type { ReportResult, ReportRow } from "@/lib/reports/types";
import { PageHeader } from "@/components/PageHeader";
import { useUrlParams } from "@/components/useUrlParams";

interface Props {
  report: ReportResult;
  /** Registry key used by /api/reports/<key>. */
  exportKey: string;
  /** Current filters as a query string (without page) for the export links. */
  exportQuery: string;
  filters?: ReactNode;
  canExport: boolean;
  description?: string;
}

const ROW_STYLE: Record<string, React.CSSProperties> = {
  section: { background: "#f5f7f7", fontWeight: 600 },
  subtotal: { fontWeight: 600 },
  total: { fontWeight: 700, background: "#eef6f4" },
};

/** Filters + summary + table + totals + PDF / Excel export for any report. */
export function ReportShell({
  report,
  exportKey,
  exportQuery,
  filters,
  canExport,
  description,
}: Props) {
  const { setParams, pending } = useUrlParams();
  const exportHref = (format: string) =>
    `/api/reports/${exportKey}?${exportQuery}${exportQuery ? "&" : ""}format=${format}`;

  // Rows link from the first text column (invoice number, party name, account).
  const flagged = report.columns.findIndex((c) => c.link);
  const linkColumn =
    flagged >= 0 ? flagged : report.columns.findIndex((c) => !c.type || c.type === "text");

  const columns: TableColumnsType<ReportRow> = report.columns.map((c, i) => ({
    key: c.key,
    title: c.title,
    dataIndex: c.key,
    align: isNumericColumn(c) ? ("right" as const) : undefined,
    render: (_: unknown, row: ReportRow) => {
      const text = cellText(c, row[c.key]);
      const style = i === 0 && row._level ? { paddingLeft: row._level * 16 } : undefined;
      if (i === linkColumn && row._href) {
        return (
          <span style={style}>
            <Link href={row._href}>{text}</Link>
          </span>
        );
      }
      if (c.type === "money" && text.startsWith("-")) {
        return <Typography.Text type="danger">{text}</Typography.Text>;
      }
      return <span style={style}>{text}</span>;
    },
  }));

  return (
    <>
      <PageHeader
        title={report.title}
        description={report.subtitle ?? description}
        extra={
          canExport && (
            <Space>
              <Button icon={<FilePdfOutlined />} href={exportHref("pdf")} target="_blank">
                Print / PDF
              </Button>
              <Button icon={<FileExcelOutlined />} href={exportHref("xlsx")}>
                Excel
              </Button>
            </Space>
          )
        }
      />
      {filters && <Card style={{ marginBottom: 16 }}>{filters}</Card>}
      {report.summary && report.summary.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[24, 16]}>
            {report.summary.map((s) => (
              <Col
                key={s.label}
                xs={12}
                md={8}
                lg={Math.max(4, Math.floor(24 / report.summary!.length))}
              >
                <Statistic
                  title={s.label}
                  value={/^-?\d+(\.\d+)?$/.test(s.value) ? formatMoney(s.value) : s.value}
                  valueStyle={
                    s.tone === "bad"
                      ? { color: "#cf1322" }
                      : s.tone === "good"
                        ? { color: "#0e7c6b" }
                        : undefined
                  }
                />
              </Col>
            ))}
          </Row>
        </Card>
      )}
      <Card>
        <Table<ReportRow>
          size="small"
          rowKey={(r) => report.rows.indexOf(r)}
          columns={columns}
          dataSource={report.rows}
          loading={pending}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: <Empty description={report.notes?.[0] ?? "No records for these filters"} />,
          }}
          onRow={(r) => ({ style: ROW_STYLE[r._kind ?? "row"] })}
          pagination={
            report.paging
              ? {
                  current: report.paging.page,
                  pageSize: report.paging.pageSize,
                  total: report.paging.total,
                  showSizeChanger: true,
                  pageSizeOptions: ["20", "50", "100", "200"],
                  showTotal: (t) => `${t} records`,
                }
              : false
          }
          onChange={(pg) => {
            if (report.paging)
              setParams({ page: pg.current ?? 1, pageSize: pg.pageSize ?? 50 }, false);
          }}
          summary={
            report.totals
              ? () => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ fontWeight: 700, background: "#eef6f4" }}>
                      {report.columns.map((c, i) => (
                        <Table.Summary.Cell
                          key={c.key}
                          index={i}
                          align={isNumericColumn(c) ? "right" : undefined}
                        >
                          {cellText(c, report.totals![c.key])}
                        </Table.Summary.Cell>
                      ))}
                    </Table.Summary.Row>
                  </Table.Summary>
                )
              : undefined
          }
        />
        {report.rows.length > 0 &&
          (report.notes ?? []).map((n) => (
            <Typography.Paragraph
              key={n}
              type="secondary"
              style={{ marginTop: 8, marginBottom: 0 }}
            >
              {n}
            </Typography.Paragraph>
          ))}
      </Card>
    </>
  );
}
