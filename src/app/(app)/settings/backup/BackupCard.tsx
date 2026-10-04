"use client";

import { Alert, Button, Card, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/PageHeader";

export function BackupCard({ canExport }: { canExport: boolean }) {
  return (
    <>
      <PageHeader
        title="Database Backup"
        description="Download a copy of all of your agency's data."
      />
      <Card style={{ maxWidth: 720 }}>
        <Typography.Paragraph>
          The download is a single JSON file with every record that belongs to this agency:
          settings, users (without passwords), configuration lists and, as later modules go live,
          clients, invoices and accounts. Keep it somewhere safe; it contains customer data.
        </Typography.Paragraph>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Full server backups are taken automatically by the hosting setup. This export is for your own records."
        />
        {canExport ? (
          <Button type="primary" icon={<DownloadOutlined />} href="/api/backup">
            Download backup (JSON)
          </Button>
        ) : (
          <Alert
            type="warning"
            message="Your role does not include exporting configuration data."
          />
        )}
      </Card>
    </>
  );
}
