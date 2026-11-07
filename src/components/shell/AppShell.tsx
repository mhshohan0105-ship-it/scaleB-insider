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
  CloudServerOutlined,
  CrownOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { navEntries, type NavModule } from "@/lib/nav";
import type { ModuleKey } from "@/lib/permissions";
import { THEME } from "@/components/Providers";
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
  /** Modules the user may create records in (fills "+ New"). */
  creatable: ModuleKey[];
  user: ShellUser;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}

export function AppShell({ nav, creatable, user, logoutAction, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  // Below the lg breakpoint the sidebar is hidden and slides in over the page.
  const [narrow, setNarrow] = useState(false);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const searchSeq = useRef(0);
  const searchBox = useRef<HTMLDivElement>(null);

  // Choosing a page on a phone closes the sliding sidebar.
  useEffect(() => {
    if (narrow) setCollapsed(true);
  }, [pathname, narrow]);

  // Ctrl+K (Cmd+K) jumps to the search box from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchBox.current?.querySelector("input")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // "+ New": every create page the user may use, grouped by module.
  const createMenu: MenuProps["items"] = useMemo(() => {
    const groups = new Map<string, { key: string; label: ReactNode }[]>();
    for (const e of entries) {
      if (!e.leaf.href.endsWith("/new") || !creatable.includes(e.module.module)) continue;
      const label = e.leaf.label.replace(/^New\s+/, "").replace(/: Create$/, "");
      const list = groups.get(e.module.label) ?? [];
      list.push({ key: e.leaf.href, label: <Link href={e.leaf.href}>{label}</Link> });
      groups.set(e.module.label, list);
    }
    return [...groups].map(([group, children]) =>
      children.length === 1
        ? { key: children[0]!.key, label: <Link href={children[0]!.key}>{group}</Link> }
        : { key: group, label: group, children },
    );
  }, [entries, creatable]);

  const menuItems: MenuProps["items"] = useMemo(
    () =>
      nav.map((m) => {
        const icon = NAV_ICONS[m.icon] ?? FALLBACK_ICON;
        if (m.hub) return { key: m.hub, icon, label: <Link href={m.hub}>{m.label}</Link> };
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
          {
            key: "backups",
            icon: <CloudServerOutlined />,
            label: <Link href="/admin/backups">Database backups</Link>,
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
        collapsedWidth={narrow ? 0 : 80}
        onBreakpoint={(broken) => {
          setNarrow(broken);
          setCollapsed(broken);
        }}
        style={
          narrow
            ? { position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 30 }
            : { position: "sticky", top: 0, height: "100vh" }
        }
      >
        <div className="shell-logo">
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="shell-logo-icon"
              src="/brand/scaleb-insider-icon.svg"
              alt="ScaleB Insider"
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="shell-logo-full"
                src="/brand/scaleb-insider-dark.svg"
                alt="ScaleB Insider"
              />
            </>
          )}
        </div>
        <div className="shell-sider-scroll">
          <Menu
            theme="dark"
            mode="inline"
            items={menuItems}
            selectedKeys={
              active ? [nav.find((m) => m.module === active.module)?.hub ?? active.href] : []
            }
            openKeys={collapsed ? undefined : openKeys}
            onOpenChange={(keys) => setOpenKeys(keys.slice(-1))}
            aria-label="Main navigation"
          />
        </div>
      </Layout.Sider>

      {narrow && !collapsed && (
        <div className="shell-backdrop" aria-hidden="true" onClick={() => setCollapsed(true)} />
      )}

      <Layout style={{ minWidth: 0 }}>
        <Layout.Header className="shell-header">
          <Button
            type="text"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div ref={searchBox} className="shell-search">
            <AutoComplete
              style={{ width: "100%" }}
              options={searchOptions}
              value={search}
              onChange={setSearch}
              onSelect={(href: string) => {
                setSearch("");
                router.push(href);
              }}
            >
              <Input
                prefix={<SearchOutlined style={{ color: THEME.muted }} />}
                suffix={<span className="shell-kbd shell-wide-only">Ctrl K</span>}
                placeholder="Search invoice, ticket, client, passport…"
                allowClear
                aria-label="Search"
              />
            </AutoComplete>
          </div>

          <div className="shell-header-spacer" />
          {createMenu && createMenu.length > 0 && (
            <Dropdown menu={{ items: createMenu }} trigger={["click"]} placement="bottomRight">
              <Button type="primary" icon={<PlusOutlined />}>
                New
              </Button>
            </Dropdown>
          )}
          <span className="shell-wide-only">
            <LiveClock />
          </span>
          <NotificationBell />
          <Dropdown menu={{ items: userMenu }} trigger={["click"]} placement="bottomRight">
            <Button
              type="text"
              style={{ height: 48, display: "flex", alignItems: "center", gap: 8 }}
            >
              <Avatar style={{ background: THEME.brand, fontWeight: 600 }}>
                {initials(user.name)}
              </Avatar>
              <span className="shell-wide-only" style={{ textAlign: "left", lineHeight: 1.2 }}>
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

/** "Md. Karim Hossain" -> "KH" (titles like Md. are skipped). */
function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w && !/^(md|mohammad|mohammed|mst|mrs?|ms|dr)\.?$/i.test(w));
  const pick = words.length ? words : name.split(/\s+/);
  const first = pick[0]?.[0] ?? "";
  const last = pick.length > 1 ? (pick[pick.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
