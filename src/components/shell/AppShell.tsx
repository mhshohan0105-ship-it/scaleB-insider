"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Alert,
  AutoComplete,
  Avatar,
  Button,
  Dropdown,
  Input,
  Layout,
  Menu,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  CrownOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { navEntries, type NavModule } from "@/lib/nav";
import { FALLBACK_ICON, NAV_ICONS } from "./navIcons";
import { LiveClock } from "./LiveClock";
import { NotificationBell } from "./NotificationBell";
import type { SearchHit } from "@/server/services/search/globalSearch";
import { globalSearchAction } from "@/app/(app)/shell/actions";

export interface ShellUser {
  name: string;
  username: string;
  roleName: string;
  agencyName: string;
  isSuperAdmin?: boolean;
  /** Platform admin who opened this session as the agency owner. */
  impersonatedBy?: string | null;
}

interface AppShellProps {
  nav: NavModule[];
  user: ShellUser;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}

export function AppShell({ nav, user, logoutAction, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const searchSeq = useRef(0);

  // Records (invoices, tickets, clients, ...) matching the search, debounced.
  useEffect(() => {
    const q = search.trim();
    const seq = ++searchSeq.current;
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await globalSearchAction(q);
      if (seq === searchSeq.current && r.ok) setHits(r.data);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const entries = useMemo(() => navEntries(nav), [nav]);

  const menuItems: MenuProps["items"] = useMemo(
    () =>
      nav.map((m) => {
        const icon = NAV_ICONS[m.icon] ?? FALLBACK_ICON;
        if (!m.children) {
          return { key: m.href!, icon, label: <Link href={m.href!}>{m.label}</Link> };
        }
        return {
          key: m.module,
          icon,
          label: m.label,
          children: m.children.map((c) => ({
            key: c.href,
            label: <Link href={c.href}>{c.label}</Link>,
          })),
        };
      }),
    [nav],
  );

  // Highlight the most specific nav entry that owns the current path.
  const active = useMemo(() => {
    let best: { href: string; module: string } | undefined;
    for (const e of entries) {
      const h = e.leaf.href;
      if (
        (pathname === h || pathname.startsWith(`${h}/`)) &&
        (!best || h.length > best.href.length)
      ) {
        best = { href: h, module: e.module.module };
      }
    }
    return best;
  }, [entries, pathname]);

  const [openKeys, setOpenKeys] = useState<string[]>(active ? [active.module] : []);

  const searchOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const menu = entries
      .filter((e) => `${e.module.label} ${e.leaf.label}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map((e) => ({
        value: e.leaf.href,
        label: (
          <span>
            {e.leaf.label}
            {e.leaf.label !== e.module.label && (
              <Typography.Text type="secondary"> · {e.module.label}</Typography.Text>
            )}
          </span>
        ),
      }));
    const groups = new Map<string, SearchHit[]>();
    for (const h of hits) groups.set(h.group, [...(groups.get(h.group) ?? []), h]);
    return [
      ...(menu.length ? [{ label: "Pages", options: menu }] : []),
      ...[...groups].map(([group, list]) => ({
        label: group,
        options: list.map((h) => ({
          value: h.href,
          label: (
            <span>
              {h.label}
              {h.detail && <Typography.Text type="secondary"> · {h.detail}</Typography.Text>}
            </span>
          ),
        })),
      })),
    ];
  }, [entries, search, hits]);

  const userMenu: MenuProps["items"] = [
    ...(user.isSuperAdmin
      ? [
          {
            key: "admin",
            icon: <CrownOutlined />,
            label: <Link href="/admin">Platform admin</Link>,
          },
        ]
      : []),
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link href="/settings/profile">Profile</Link>,
    },
    {
      key: "password",
      icon: <KeyOutlined />,
      label: <Link href="/account/password">Change password</Link>,
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      danger: true,
      label: "Sign out",
      onClick: () => void logoutAction(),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        width={250}
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
        style={{ position: "sticky", top: 0, height: "100vh" }}
      >
        <div className="shell-logo">
          <span className="shell-logo-mark">sB</span>
          {!collapsed && <span>scaleB Insider</span>}
        </div>
        <div className="shell-sider-scroll">
          <Menu
            theme="dark"
            mode="inline"
            items={menuItems}
            selectedKeys={active ? [active.href] : []}
            openKeys={collapsed ? undefined : openKeys}
            onOpenChange={(keys) => setOpenKeys(keys.slice(-1))}
            aria-label="Main navigation"
          />
        </div>
      </Layout.Sider>

      <Layout>
        <Layout.Header className="shell-header">
          <Button
            type="text"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <AutoComplete
            style={{ width: 340, maxWidth: "40vw" }}
            options={searchOptions}
            value={search}
            onChange={setSearch}
            onSelect={(href: string) => {
              setSearch("");
              router.push(href);
            }}
          >
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search pages, invoices, tickets, clients…"
              allowClear
              aria-label="Search"
            />
          </AutoComplete>

          <div className="shell-header-spacer" />
          <LiveClock />
          <NotificationBell />
          <Dropdown menu={{ items: userMenu }} trigger={["click"]} placement="bottomRight">
            <Button
              type="text"
              style={{ height: 48, display: "flex", alignItems: "center", gap: 8 }}
            >
              <Avatar size="small" style={{ background: "#0e7c6b" }}>
                {user.name.slice(0, 1).toUpperCase()}
              </Avatar>
              <span style={{ textAlign: "left", lineHeight: 1.2 }}>
                <div>{user.name}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {user.roleName} · {user.agencyName}
                </Typography.Text>
              </span>
            </Button>
          </Dropdown>
        </Layout.Header>

        <Layout.Content className="shell-content">
          {user.impersonatedBy && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`You are in ${user.agencyName} as ${user.name}, opened by ${user.impersonatedBy} (platform admin). Everything you do is recorded. Sign out to end.`}
            />
          )}
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
