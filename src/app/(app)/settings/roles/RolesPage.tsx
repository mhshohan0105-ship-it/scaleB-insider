"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Drawer,
  Form,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { LockOutlined, PlusOutlined } from "@ant-design/icons";
import { NAV } from "@/lib/nav";
import { ACTIONS, type Action, type ModuleKey, type PermissionMap } from "@/lib/permissions";
import type { RoleRow } from "@/server/services/roles/roleService";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { saveRoleAction } from "../actions";

const ACTION_LABELS: Record<Action, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  void: "Void",
  export: "Export",
};

interface MatrixRow {
  module: ModuleKey;
  label: string;
}

const MATRIX_ROWS: MatrixRow[] = NAV.map((m) => ({ module: m.module, label: m.label }));

function countGranted(p: PermissionMap) {
  return Object.values(p).filter((a) => a && a.length > 0).length;
}

export function RolesPage({
  roles,
  canCreate,
  canEdit,
}: {
  roles: RoleRow[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<RoleRow | "new" | null>(null);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<PermissionMap>({});
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string>();

  const role = editing && editing !== "new" ? editing : null;
  const readOnly = !canEdit || !!role?.locked;

  function open(target: RoleRow | "new") {
    setEditing(target);
    setName(target === "new" ? "" : target.name);
    setPerms(target === "new" ? {} : structuredClone(target.permissions));
    setNameError(undefined);
  }

  function toggle(module: ModuleKey, action: Action, on: boolean) {
    setPerms((prev) => {
      const current = new Set(prev[module] ?? []);
      if (on) {
        current.add(action);
        current.add("view"); // any action implies view
      } else {
        current.delete(action);
        if (action === "view") current.clear(); // no view means no access at all
      }
      return { ...prev, [module]: ACTIONS.filter((a) => current.has(a)) };
    });
  }

  function toggleRow(module: ModuleKey, on: boolean) {
    setPerms((prev) => ({ ...prev, [module]: on ? [...ACTIONS] : [] }));
  }

  function toggleColumn(action: Action, on: boolean) {
    for (const r of MATRIX_ROWS) toggle(r.module, action, on);
  }

  async function save() {
    setSaving(true);
    const result = await saveRoleAction(role?.id ?? null, { name, permissions: perms });
    setSaving(false);
    if (!result.ok) setNameError(result.fieldErrors?.name);
    if (applyActionResult(result, null, message, "Role saved")) {
      setEditing(null);
      router.refresh();
    }
  }

  const matrixColumns = useMemo<TableColumnsType<MatrixRow>>(
    () => [
      { title: "Module", dataIndex: "label", key: "label" },
      ...ACTIONS.map((action) => {
        const all = MATRIX_ROWS.every((r) => perms[r.module]?.includes(action));
        const some = MATRIX_ROWS.some((r) => perms[r.module]?.includes(action));
        return {
          key: action,
          align: "center" as const,
          width: 90,
          title: (
            <Space direction="vertical" size={0} align="center">
              {ACTION_LABELS[action]}
              <Checkbox
                aria-label={`All ${action}`}
                disabled={readOnly}
                checked={all}
                indeterminate={some && !all}
                onChange={(e) => toggleColumn(action, e.target.checked)}
              />
            </Space>
          ),
          render: (_: unknown, r: MatrixRow) => (
            <Checkbox
              aria-label={`${r.label} ${action}`}
              disabled={readOnly}
              checked={!!perms[r.module]?.includes(action)}
              onChange={(e) => toggle(r.module, action, e.target.checked)}
            />
          ),
        };
      }),
      {
        key: "all",
        title: "All",
        align: "center" as const,
        width: 70,
        render: (_: unknown, r: MatrixRow) => (
          <Checkbox
            aria-label={`${r.label} all`}
            disabled={readOnly}
            checked={(perms[r.module]?.length ?? 0) === ACTIONS.length}
            indeterminate={
              (perms[r.module]?.length ?? 0) > 0 && (perms[r.module]?.length ?? 0) < ACTIONS.length
            }
            onChange={(e) => toggleRow(r.module, e.target.checked)}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perms, readOnly],
  );

  const roleColumns: TableColumnsType<RoleRow> = [
    {
      title: "Role",
      key: "name",
      render: (_, r) => (
        <Space>
          {r.name}
          {r.isSystem && <Tag>Default</Tag>}
          {r.locked && <LockOutlined title="Always has full access" />}
        </Space>
      ),
    },
    { title: "Users", dataIndex: "userCount", key: "users", width: 100 },
    {
      title: "Modules",
      key: "modules",
      render: (_, r) => `${countGranted(r.permissions)} of ${MATRIX_ROWS.length}`,
    },
    {
      key: "actions",
      align: "right",
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => open(r)}>
          {canEdit && !r.locked ? "Edit permissions" : "View permissions"}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Roles"
        description="What each role can see and do. Changes apply on the user's next page load."
        extra={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>
              Add Role
            </Button>
          )
        }
      />
      <Card>
        <Table<RoleRow> rowKey="id" columns={roleColumns} dataSource={roles} pagination={false} />
      </Card>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        width={820}
        title={editing === "new" ? "New role" : `Role: ${role?.name ?? ""}`}
        extra={
          !readOnly && (
            <Button type="primary" loading={saving} onClick={save}>
              Save role
            </Button>
          )
        }
        destroyOnHidden
      >
        {role?.locked && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="The Owner role always has full access so the agency can never be locked out."
          />
        )}
        <Form layout="vertical">
          <Form.Item
            label="Role name"
            validateStatus={nameError ? "error" : undefined}
            help={nameError ?? (role?.isSystem ? "Default roles keep their name." : undefined)}
          >
            <Input
              value={name}
              maxLength={60}
              disabled={readOnly || !!role?.isSystem}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary">
          Ticking any action also grants View. Unticking View removes all access to that module.
        </Typography.Paragraph>
        <Table<MatrixRow>
          rowKey="module"
          size="small"
          columns={matrixColumns}
          dataSource={MATRIX_ROWS}
          pagination={false}
          bordered
        />
      </Drawer>
    </>
  );
}
