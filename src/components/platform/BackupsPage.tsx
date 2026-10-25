"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CloudServerOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  GoogleOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { formatDateTime } from "@/lib/format";
import type { BackupOverview } from "@/server/services/backup/platformBackup";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import {
  backupNowAction,
  disconnectGoogleAction,
  saveGoogleClientAction,
} from "@/app/(app)/platform/actions";

type Run = BackupOverview["runs"][number];

const STATUS: Record<string, { color: string; label: string }> = {
  OK: { color: "green", label: "OK" },
  PARTIAL: { color: "orange", label: "Incomplete" },
  FAILED: { color: "red", label: "Failed" },
  RUNNING: { color: "blue", label: "Running" },
};

function size(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupsPage({
  data,
  driveMessage,
}: {
  data: BackupOverview;
  driveMessage: { ok: boolean; text: string } | null;
}) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [running, setRunning] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [form] = Form.useForm<{ clientId: string; clientSecret: string }>();
  const last = data.runs.find((r) => r.status !== "RUNNING");
  const lastOk = data.runs.find((r) => r.status === "OK" || r.status === "PARTIAL");

  async function backupNow() {
    setRunning(true);
    const r = await backupNowAction();
    setRunning(false);
    if (r.ok) {
      if (r.data.status === "OK") message.success(`Backup ${r.data.fileName} saved`);
      else message.warning(r.data.error ?? "Backup incomplete");
      router.refresh();
    } else message.error(r.error);
  }

  async function saveClient() {
    const v = await form.validateFields();
    setSavingClient(true);
    const r = await saveGoogleClientAction(v);
    setSavingClient(false);
    if (applyActionResult(r, form, message, "Saved. Now click Connect Google Drive.")) {
      form.resetFields();
      router.refresh();
    }
  }

  function disconnect() {
    modal.confirm({
      title: "Disconnect Google Drive?",
      content: "New backups stay on the server only. Files already on Drive are kept.",
      okText: "Disconnect",
      okButtonProps: { danger: true },
      onOk: async () => {
        const r = await disconnectGoogleAction();
        if (applyActionResult(r, null, message, "Disconnected")) router.refresh();
      },
    });
  }

  const columns: TableColumnsType<Run> = [
    { title: "Started", dataIndex: "startedAt", render: (v: string) => formatDateTime(v), width: 170 },
    {
      title: "Type",
      dataIndex: "kind",
      width: 100,
      render: (v: string) => (v === "MANUAL" ? "Manual" : "Nightly"),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => <Tag color={STATUS[v]?.color}>{STATUS[v]?.label ?? v}</Tag>,
    },
    {
      title: "Saved to",
      key: "where",
      width: 170,
      render: (_, r) => (
        <Space size={4}>
          {r.savedLocal && <Tag icon={<CloudServerOutlined />}>Server</Tag>}
          {r.onDrive && (
            <Tag icon={<GoogleOutlined />} color="blue">
              Drive
            </Tag>
          )}
        </Space>
      ),
    },
    { title: "Size", dataIndex: "sizeBytes", width: 90, align: "right", render: size },
    {
      title: "Rows",
      dataIndex: "rows",
      width: 90,
      align: "right",
      render: (v: number | null) => v?.toLocaleString("en-US") ?? "",
    },
    {
      title: "Details",
      key: "details",
      render: (_, r) =>
        r.error ? (
          <Typography.Text type={r.status === "FAILED" ? "danger" : "warning"} style={{ whiteSpace: "pre-line" }}>
            {r.error}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">{r.fileName}</Typography.Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Database backups"
        description="Full backups of every agency, taken every night at 02:00 (Dhaka time), encrypted, kept on the server and on Google Drive."
        extra={
          <Button type="primary" icon={<CloudUploadOutlined />} loading={running} onClick={backupNow}>
            Back up now
          </Button>
        }
      />

      {driveMessage && (
        <Alert
          type={driveMessage.ok ? "success" : "error"}
          showIcon
          closable
          message={driveMessage.text}
          style={{ marginBottom: 16 }}
        />
      )}
      {last && last.status !== "OK" && (
        <Alert
          type={last.status === "FAILED" ? "error" : "warning"}
          showIcon
          style={{ marginBottom: 16 }}
          message={`The last backup (${formatDateTime(last.startedAt)}) was ${STATUS[last.status]?.label.toLowerCase()}`}
          description={<span style={{ whiteSpace: "pre-line" }}>{last.error}</span>}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card title={<Space><SafetyCertificateOutlined />Status</Space>} style={{ height: "100%" }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Last good backup">
                {lastOk ? formatDateTime(lastOk.startedAt) : "None yet"}
              </Descriptions.Item>
              <Descriptions.Item label="Copies on server">{data.localFiles.length}</Descriptions.Item>
              <Descriptions.Item label="Server folder">
                <Typography.Text code copyable>
                  {data.folder}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Kept">
                {
                  "30 days of nightly copies, each month's last copy for 12 months, each June's last copy forever, manual copies for 90 days."
                }
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><GoogleOutlined />Google Drive</Space>} style={{ height: "100%" }}>
            {data.drive.connected ? (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Tag color="green">Connected</Tag>
                <Typography.Text>
                  Backups go to the folder <b>scaleB Insider backups</b> in{" "}
                  <b>{data.drive.email ?? "the connected account"}</b>. The app can see only the
                  files it uploads.
                </Typography.Text>
                <Space wrap>
                  <Button href="/api/admin/backups/google?start=1">Reconnect</Button>
                  <Button danger onClick={disconnect}>
                    Disconnect
                  </Button>
                </Space>
              </Space>
            ) : data.drive.hasClient ? (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Tag color="orange">Not connected</Tag>
                <Typography.Text>
                  Sign in with the Google account whose Drive should hold the backups.
                </Typography.Text>
                <Button type="primary" icon={<GoogleOutlined />} href="/api/admin/backups/google?start=1">
                  Connect Google Drive
                </Button>
                <Typography.Link onClick={() => form.setFieldsValue({ clientId: data.drive.clientId ?? "" })}>
                  Change the Google client below
                </Typography.Link>
              </Space>
            ) : (
              <Space direction="vertical">
                <Tag color="orange">Not set up</Tag>
                <Typography.Text>
                  Create a Google OAuth client (steps in DEPLOYMENT.md) and paste its ID and secret
                  below.
                </Typography.Text>
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><KeyOutlined />Recovery key</Space>} style={{ height: "100%" }}>
            <Typography.Paragraph>
              Every backup is encrypted. Download this key once and keep it outside the server (a
              password manager or a USB drive). Without it the copies on Google Drive cannot be
              opened.
            </Typography.Paragraph>
            <Button icon={<KeyOutlined />} href="/api/admin/backups/key">
              Download recovery key
            </Button>
          </Card>
        </Col>
      </Row>

      {!data.drive.connected && (
        <Card title="Google OAuth client" style={{ marginBottom: 16, maxWidth: 760 }}>
          <Typography.Paragraph type="secondary">
            In Google Cloud Console create an OAuth client of type <b>Web application</b> with this
            authorised redirect URI:{" "}
            <Typography.Text code copyable>
              {data.redirectUri}
            </Typography.Text>
          </Typography.Paragraph>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="clientId" label="Client ID" rules={[{ required: true }]}>
                  <Input placeholder="….apps.googleusercontent.com" autoComplete="off" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="clientSecret" label="Client secret" rules={[{ required: true }]}>
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" loading={savingClient} onClick={saveClient}>
              Save client
            </Button>
          </Form>
        </Card>
      )}

      <Card title="History">
        <Table<Run>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={data.runs}
          pagination={{ pageSize: 15 }}
          scroll={{ x: 900 }}
        />
      </Card>

      {data.localFiles.length > 0 && (
        <Card title="Copies on the server" style={{ marginTop: 16 }}>
          <Table
            rowKey="name"
            size="small"
            dataSource={data.localFiles}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: "File", dataIndex: "name" },
              { title: "Date", dataIndex: "date", width: 120 },
              {
                title: "",
                key: "dl",
                width: 120,
                render: (_, f) => (
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    href={`/api/admin/backups/file?name=${encodeURIComponent(f.name)}`}
                  >
                    Download
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}
