"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { FieldOption } from "@/lib/masters";
import type { ActionResult } from "@/lib/actionResult";
import type { ListParams } from "@/lib/listParams";
import { formatDateTime } from "@/lib/format";
import type { UserRow } from "@/server/services/users/userService";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import {
  createUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "../actions";

interface UsersPageProps {
  rows: UserRow[];
  total: number;
  params: ListParams;
  options: { roles: FieldOption[]; employees: FieldOption[] };
  currentUserId: string;
  canCreate: boolean;
  canEdit: boolean;
}

const PASSWORD_HELP = "At least 8 characters, with letters and numbers.";

export function UsersPage({
  rows,
  total,
  params,
  options,
  currentUserId,
  canCreate,
  canEdit,
}: UsersPageProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [form] = Form.useForm();
  const [resetForm] = Form.useForm();

  const columns = useMemo<TableColumnsType<UserRow>>(
    () => [
      {
        title: "Name",
        key: "name",
        render: (_, u) => (
          <>
            {u.name} {u.id === currentUserId && <Tag>You</Tag>}
            <div>
              <Typography.Text type="secondary">@{u.username}</Typography.Text>
            </div>
          </>
        ),
      },
      { title: "Role", dataIndex: "roleName", key: "role" },
      { title: "Phone", dataIndex: "phone", key: "phone", render: (v) => v ?? "-" },
      { title: "Employee", dataIndex: "employeeName", key: "employee", render: (v) => v ?? "-" },
      {
        title: "Last login",
        dataIndex: "lastLoginAt",
        key: "lastLogin",
        render: (v: string | null) => (v ? formatDateTime(v) : "Never"),
      },
      {
        title: "Status",
        key: "status",
        render: (_, u) => (u.isActive ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
      },
      ...(canEdit
        ? [
            {
              key: "actions",
              align: "right" as const,
              render: (_: unknown, u: UserRow) => (
                <Space size={4}>
                  <Button size="small" type="link" onClick={() => setEditing(u)}>
                    Edit
                  </Button>
                  <Button size="small" type="link" onClick={() => setResetting(u)}>
                    Reset password
                  </Button>
                  {u.id !== currentUserId && (
                    <Popconfirm
                      title={u.isActive ? "Deactivate this user?" : "Activate this user?"}
                      description={
                        u.isActive ? "They will be signed out and unable to log in." : undefined
                      }
                      onConfirm={async () => {
                        const r = await setUserActiveAction(u.id, !u.isActive);
                        if (
                          applyActionResult(
                            r,
                            null,
                            message,
                            u.isActive ? "User deactivated" : "User activated",
                          )
                        ) {
                          router.refresh();
                        }
                      }}
                    >
                      <Button size="small" type="link" danger={u.isActive}>
                        {u.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]
        : []),
    ],
    [canEdit, currentUserId, message, router],
  );

  const isNew = editing === "new";
  const editingRow = editing && editing !== "new" ? editing : null;

  async function saveUser() {
    const values = await form.validateFields();
    const result: ActionResult<unknown> = isNew
      ? await createUserAction(values)
      : await updateUserAction(editingRow!.id, values);
    if (applyActionResult(result, form, message, isNew ? "User created" : "User updated")) {
      setEditing(null);
      router.refresh();
    }
  }

  async function resetPassword() {
    const values = await resetForm.validateFields();
    const result = await resetUserPasswordAction(resetting!.id, values);
    if (applyActionResult(result, resetForm, message, "Password reset")) setResetting(null);
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="People who can sign in to this agency."
        extra={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
              Add User
            </Button>
          )
        }
      />
      <Card>
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Search name, username, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(q) => setParams({ q })}
            style={{ width: 300 }}
          />
          <Select
            value={params.status}
            onChange={(status) => setParams({ status: status === "active" ? null : status })}
            style={{ width: 130 }}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "all", label: "All" },
            ]}
          />
        </Flex>
        <DataTable<UserRow>
          rows={rows}
          total={total}
          page={params.page}
          pageSize={params.pageSize}
          columns={columns}
        />
      </Card>

      <Modal
        open={editing !== null}
        title={isNew ? "Add User" : `Edit ${editingRow?.name ?? "User"}`}
        okText={isNew ? "Create user" : "Save changes"}
        onOk={saveUser}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={
            editingRow
              ? {
                  name: editingRow.name,
                  email: editingRow.email,
                  phone: editingRow.phone,
                  roleId: editingRow.roleId,
                  employeeId: editingRow.employeeId,
                }
              : undefined
          }
        >
          <Form.Item
            label="Full name"
            name="name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          {isNew && (
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: "Username is required" }]}
              extra="Used to sign in. Cannot be changed later."
            >
              <Input maxLength={60} autoComplete="off" />
            </Form.Item>
          )}
          <Form.Item
            label="Role"
            name="roleId"
            rules={[{ required: true, message: "Choose a role" }]}
          >
            <Select
              options={options.roles}
              disabled={editingRow?.id === currentUserId}
              placeholder="Select role"
            />
          </Form.Item>
          <Form.Item
            label="Linked employee"
            name="employeeId"
            extra="Optional. Used for salesman reports."
          >
            <Select allowClear showSearch optionFilterProp="label" options={options.employees} />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ type: "email", message: "Enter a valid email" }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item label="Phone" name="phone">
            <Input maxLength={30} />
          </Form.Item>
          {isNew && (
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: "Password is required" }]}
              extra={PASSWORD_HELP}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        open={resetting !== null}
        title={`Reset password for ${resetting?.name ?? ""}`}
        okText="Set password"
        onOk={resetPassword}
        onCancel={() => setResetting(null)}
        destroyOnHidden
      >
        <Form form={resetForm} layout="vertical" preserve={false}>
          <Form.Item
            label="New password"
            name="password"
            rules={[{ required: true, message: "Enter a password" }]}
            extra={PASSWORD_HELP}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
