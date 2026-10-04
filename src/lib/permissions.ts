// Role based access control primitives. Pure and shared by server and client.
// Module keys match the sidebar (PLAN.md section 4).

export const MODULE_KEYS = [
  "dashboard",
  "invoice_air",
  "invoice_noncommission",
  "reissue",
  "invoice_other",
  "invoice_otherpackage",
  "invoice_visa",
  "invoice_tour",
  "hajj",
  "hajji_management",
  "invoice_umrah",
  "refund",
  "money_receipt",
  "accounts",
  "cheques",
  "payroll",
  "expense",
  "loan",
  "clients",
  "vendors",
  "agents",
  "quotation",
  "passport",
  "reports",
  "configuration",
  "feedback",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ACTIONS = ["view", "create", "edit", "void", "export"] as const;
export type Action = (typeof ACTIONS)[number];

export type PermissionMap = Partial<Record<ModuleKey, Action[]>>;

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

/** Normalises an untrusted JSON value (e.g. Role.permissions) into a PermissionMap. */
export function parsePermissions(raw: unknown): PermissionMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: PermissionMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isModuleKey(key) || !Array.isArray(value)) continue;
    const actions = value.filter((a): a is Action => (ACTIONS as readonly unknown[]).includes(a));
    if (actions.length > 0) result[key] = Array.from(new Set(actions));
  }
  return result;
}

/** True when the permission map allows `action` on `module`. Any action implies view. */
export function can(permissions: PermissionMap, module: ModuleKey, action: Action): boolean {
  const granted = permissions[module];
  if (!granted || granted.length === 0) return false;
  return action === "view" ? true : granted.includes(action);
}

function grant(modules: readonly ModuleKey[], actions: readonly Action[]): PermissionMap {
  return Object.fromEntries(modules.map((m) => [m, [...actions]]));
}

const SALES_MODULES: ModuleKey[] = [
  "invoice_air",
  "invoice_noncommission",
  "reissue",
  "invoice_other",
  "invoice_otherpackage",
  "invoice_visa",
  "invoice_tour",
  "hajj",
  "hajji_management",
  "invoice_umrah",
  "money_receipt",
  "clients",
  "quotation",
  "passport",
];

/** Default roles seeded for every new agency. */
export const DEFAULT_ROLES: { name: string; permissions: PermissionMap }[] = [
  { name: "Owner", permissions: grant(MODULE_KEYS, ACTIONS) },
  {
    name: "Accountant",
    permissions: {
      ...grant(MODULE_KEYS, ["view", "create", "edit", "void", "export"]),
      configuration: ["view"],
    },
  },
  {
    name: "Sales Staff",
    permissions: {
      dashboard: ["view"],
      reports: ["view"],
      vendors: ["view"],
      agents: ["view"],
      feedback: ["view", "create"],
      ...grant(SALES_MODULES, ["view", "create", "edit"]),
    },
  },
  { name: "Viewer", permissions: grant(MODULE_KEYS, ["view"]) },
];
