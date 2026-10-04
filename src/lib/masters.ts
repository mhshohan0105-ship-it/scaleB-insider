// Configuration masters (PLAN.md section 8) described as data. One definition
// drives the list page, the modal form, Zod validation and the generic service.
// Parties (clients, vendors, ...) use the same engine; see src/lib/parties.ts.
// Shared by client and server, so no server imports here.
import { z } from "zod";
import type { ModuleKey } from "./permissions";

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "code"
  | "int"
  | "money"
  | "percent"
  | "select"
  | "ref"
  | "date"
  | "bool";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Max length for text, max value for int. */
  max?: number;
  min?: number;
  options?: readonly FieldOption[];
  /** For type "ref": the master or party list that supplies options. */
  ref?: EntityKey;
  /** For type "ref": Prisma relation name used to show the label in lists. */
  relation?: string;
  /** Show as a column in the list table (default true for the first 4 fields). */
  listed?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  /** Help text under the form field. */
  help?: string;
}

export interface MasterDef {
  key: EntityKey;
  /** Prisma delegate name, e.g. "clientCategory". */
  model: string;
  title: string;
  singular: string;
  description?: string;
  fields: FieldDef[];
  /** Text fields matched by the search box. */
  searchFields: string[];
  orderBy: string;
  /** Permission module guarding this list (default "configuration"). */
  module?: ModuleKey;
  /** When set, rows get an auto generated `code` like "CL-00001". */
  codePrefix?: string;
  /** Rows carry a cached `balance` derived from openingBalance(+Type) and, later, the ledger. */
  balance?: boolean;
  /** Base URL of the profile page; the list links names to `${profileBase}/${id}`. */
  profileBase?: string;
  /**
   * Ref relations whose cached balances are added to this row's own balance
   * for display (combined clients: own + linked client + linked vendor).
   */
  netWithRefs?: string[];
}

export const MASTER_KEYS = [
  "clientcategories",
  "countries",
  "airports",
  "airlines",
  "products",
  "visatypes",
  "departments",
  "designations",
  "employees",
  "roomtypes",
  "transporttypes",
  "passportstatus",
  "groups",
  "maharam",
  "companies",
  "cities",
  "places",
  "tourgroups",
  "tourtickets",
  "guides",
  "transports",
  "foods",
  "accommodations",
  "othertransports",
] as const;

export type MasterKey = (typeof MASTER_KEYS)[number];

export const PARTY_KEYS = ["clients", "combinedclients", "vendors", "agents"] as const;
export type PartyKey = (typeof PARTY_KEYS)[number];

/** Any list handled by the generic entity engine. */
export type EntityKey = MasterKey | PartyKey;

export function isMasterKey(value: string): value is MasterKey {
  return (MASTER_KEYS as readonly string[]).includes(value);
}

const nameField = (label = "Name"): FieldDef => ({
  name: "name",
  label,
  type: "text",
  required: true,
  max: 120,
});

const simple = (key: MasterKey, model: string, title: string, singular: string): MasterDef => ({
  key,
  model,
  title,
  singular,
  fields: [nameField()],
  searchFields: ["name"],
  orderBy: "name",
});

const costItem = (
  key: MasterKey,
  model: string,
  title: string,
  singular: string,
  extra: FieldDef[] = [],
): MasterDef => ({
  key,
  model,
  title,
  singular,
  fields: [
    nameField(),
    ...extra,
    { name: "cost", label: "Default cost", type: "money", required: true, defaultValue: "0" },
    { name: "vendorId", label: "Default vendor", type: "ref", ref: "vendors", relation: "vendor" },
    { name: "note", label: "Note", type: "textarea", max: 500, listed: false },
  ],
  searchFields: ["name"],
  orderBy: "name",
});

export const COMMISSION_BASE_OPTIONS = [
  { value: "BASE_FARE", label: "Base fare" },
  { value: "TOTAL_FARE", label: "Total fare" },
] as const;

export const PRODUCT_TYPE_OPTIONS = [
  { value: "AIR", label: "Air ticket" },
  { value: "VISA", label: "Visa" },
  { value: "TOUR", label: "Tour" },
  { value: "HAJJ", label: "Hajj" },
  { value: "UMRAH", label: "Umrah" },
  { value: "HOTEL", label: "Hotel" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "OTHER", label: "Other" },
] as const;

export const GROUP_TYPE_OPTIONS = [
  { value: "HAJJ", label: "Hajj" },
  { value: "UMRAH", label: "Umrah" },
  { value: "TOUR", label: "Tour" },
] as const;

export const MASTERS: Record<MasterKey, MasterDef> = {
  clientcategories: {
    key: "clientcategories",
    model: "clientCategory",
    title: "Client Categories",
    singular: "Client Category",
    fields: [
      nameField(),
      { name: "prefix", label: "Code prefix", type: "code", max: 6, placeholder: "e.g. CORP" },
      { name: "note", label: "Note", type: "textarea", max: 500 },
    ],
    searchFields: ["name", "prefix"],
    orderBy: "name",
  },
  countries: {
    key: "countries",
    model: "country",
    title: "Countries",
    singular: "Country",
    fields: [nameField(), { name: "iso2", label: "ISO code", type: "code", max: 2, min: 2 }],
    searchFields: ["name", "iso2"],
    orderBy: "name",
  },
  airports: {
    key: "airports",
    model: "airport",
    title: "Airports",
    singular: "Airport",
    fields: [
      { name: "iata", label: "IATA code", type: "code", required: true, max: 3, min: 3 },
      nameField("Airport name"),
      { name: "city", label: "City", type: "text", max: 80 },
      { name: "country", label: "Country", type: "text", max: 80 },
    ],
    searchFields: ["iata", "name", "city", "country"],
    orderBy: "iata",
  },
  airlines: {
    key: "airlines",
    model: "airline",
    title: "Airlines",
    singular: "Airline",
    description:
      "Commission settings here override the App Config default for tickets on this airline.",
    fields: [
      { name: "iata", label: "IATA code", type: "code", required: true, max: 3, min: 2 },
      nameField("Airline name"),
      {
        name: "commissionBase",
        label: "Commission on",
        type: "select",
        options: COMMISSION_BASE_OPTIONS,
        placeholder: "Use App Config default",
      },
      { name: "commissionPercent", label: "Default commission %", type: "percent" },
    ],
    searchFields: ["iata", "name"],
    orderBy: "name",
  },
  products: {
    key: "products",
    model: "product",
    title: "Products",
    singular: "Product",
    fields: [
      nameField(),
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: PRODUCT_TYPE_OPTIONS,
        defaultValue: "OTHER",
      },
    ],
    searchFields: ["name"],
    orderBy: "name",
  },
  visatypes: simple("visatypes", "visaType", "Visa Types", "Visa Type"),
  departments: simple("departments", "department", "Departments", "Department"),
  designations: simple("designations", "designation", "Designations", "Designation"),
  employees: {
    key: "employees",
    model: "employee",
    title: "Employees",
    singular: "Employee",
    fields: [
      nameField(),
      {
        name: "designationId",
        label: "Designation",
        type: "ref",
        ref: "designations",
        relation: "designation",
      },
      {
        name: "departmentId",
        label: "Department",
        type: "ref",
        ref: "departments",
        relation: "department",
      },
      { name: "phone", label: "Phone", type: "text", max: 30 },
      { name: "email", label: "Email", type: "email", listed: false },
      { name: "salary", label: "Monthly salary", type: "money", required: true, defaultValue: "0" },
      {
        name: "commissionPercent",
        label: "Sales commission %",
        type: "percent",
        required: true,
        defaultValue: "0",
        listed: false,
      },
      { name: "joinDate", label: "Join date", type: "date", listed: false },
      { name: "nid", label: "NID", type: "text", max: 30, listed: false },
      { name: "address", label: "Address", type: "textarea", max: 300, listed: false },
    ],
    searchFields: ["name", "phone", "email"],
    orderBy: "name",
  },
  roomtypes: simple("roomtypes", "roomType", "Room Types", "Room Type"),
  transporttypes: simple("transporttypes", "transportType", "Transport Types", "Transport Type"),
  passportstatus: simple("passportstatus", "passportStatus", "Passport Status", "Passport Status"),
  groups: {
    key: "groups",
    model: "group",
    title: "Groups",
    singular: "Group",
    description: "Hajj, Umrah and tour groups.",
    fields: [
      nameField("Group name"),
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: GROUP_TYPE_OPTIONS,
        defaultValue: "HAJJ",
      },
      { name: "year", label: "Year", type: "int", min: 2000, max: 2100 },
      { name: "leaderName", label: "Group leader", type: "text", max: 120 },
      { name: "note", label: "Note", type: "textarea", max: 500, listed: false },
    ],
    searchFields: ["name", "leaderName"],
    orderBy: "name",
  },
  maharam: {
    ...simple("maharam", "maharam", "Maharam Relations", "Maharam Relation"),
    fields: [nameField("Relation")],
  },
  companies: {
    key: "companies",
    model: "company",
    title: "Companies",
    singular: "Company",
    description: "Corporate clients' companies.",
    fields: [
      nameField("Company name"),
      { name: "contactPerson", label: "Contact person", type: "text", max: 120 },
      { name: "phone", label: "Phone", type: "text", max: 30 },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Address", type: "textarea", max: 300, listed: false },
    ],
    searchFields: ["name", "contactPerson", "phone", "email"],
    orderBy: "name",
  },
  cities: {
    key: "cities",
    model: "city",
    title: "Cities",
    singular: "City",
    fields: [nameField(), { name: "country", label: "Country", type: "text", max: 80 }],
    searchFields: ["name", "country"],
    orderBy: "name",
  },
  places: costItem("places", "place", "Places", "Place", [
    { name: "cityId", label: "City", type: "ref", ref: "cities", relation: "city" },
  ]),
  tourgroups: {
    key: "tourgroups",
    model: "tourGroup",
    title: "Tour Groups",
    singular: "Tour Group",
    fields: [nameField(), { name: "note", label: "Note", type: "textarea", max: 500 }],
    searchFields: ["name"],
    orderBy: "name",
  },
  tourtickets: costItem("tourtickets", "tourTicket", "Tour Tickets", "Tour Ticket"),
  guides: costItem("guides", "guide", "Guides", "Guide", [
    { name: "phone", label: "Phone", type: "text", max: 30 },
  ]),
  transports: costItem("transports", "transport", "Transports", "Transport"),
  foods: costItem("foods", "food", "Food", "Food Item"),
  accommodations: costItem("accommodations", "accommodation", "Accommodations", "Accommodation", [
    { name: "cityId", label: "City", type: "ref", ref: "cities", relation: "city" },
  ]),
  othertransports: costItem(
    "othertransports",
    "otherTransport",
    "Other Transports",
    "Other Transport",
  ),
};

/** Masters shown as tabs on the Tour Itinerary page, in order. */
export const TOUR_MASTER_KEYS: MasterKey[] = [
  "tourgroups",
  "cities",
  "places",
  "accommodations",
  "transports",
  "othertransports",
  "guides",
  "foods",
  "tourtickets",
];

/** Key under which list rows carry the display label of a ref field. */
export function refLabelKey(fieldName: string): string {
  return `${fieldName}__label`;
}

export function listedFields(def: MasterDef): FieldDef[] {
  return def.fields.filter((f, i) => f.listed ?? i < 4);
}

// ─── Validation ────────────────────────────────────────────────────────────

export const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/;
export const PERCENT_RE = /^\d{1,3}(\.\d{1,4})?$/;

const blankToNull = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;

function baseSchema(f: FieldDef): z.ZodType {
  const req = `${f.label} is required`;
  switch (f.type) {
    case "text":
    case "textarea": {
      const max = f.max ?? (f.type === "textarea" ? 1000 : 120);
      return z
        .string({ error: req })
        .trim()
        .max(max, `${f.label} must be at most ${max} characters`);
    }
    case "code": {
      const max = f.max ?? 10;
      const min = f.min ?? 1;
      return z
        .string({ error: req })
        .trim()
        .regex(/^[A-Za-z0-9]+$/, `${f.label} may contain only letters and digits`)
        .min(min, min === max ? `${f.label} must be ${min} characters` : `${f.label} is too short`)
        .max(max, min === max ? `${f.label} must be ${max} characters` : `${f.label} is too long`)
        .transform((s) => s.toUpperCase());
    }
    case "email":
      return z.string({ error: req }).trim().max(120).email("Enter a valid email address");
    case "int":
      return z.coerce
        .number({ error: req })
        .int(`${f.label} must be a whole number`)
        .min(f.min ?? 0, `${f.label} must be at least ${f.min ?? 0}`)
        .max(f.max ?? 1_000_000_000, `${f.label} must be at most ${f.max ?? 1_000_000_000}`);
    case "money":
      return z
        .union([z.string(), z.number()], { error: req })
        .transform((v) => String(v).trim())
        .pipe(z.string().regex(MONEY_RE, `${f.label} must be an amount with up to 2 decimals`));
    case "percent":
      return z
        .union([z.string(), z.number()], { error: req })
        .transform((v) => String(v).trim())
        .pipe(
          z
            .string()
            .regex(PERCENT_RE, `${f.label} must be a number with up to 4 decimals`)
            .refine((s) => Number(s) <= 100, `${f.label} cannot exceed 100`),
        );
    case "select": {
      const values = (f.options ?? []).map((o) => o.value);
      return z.enum(values as [string, ...string[]], { error: `Choose a valid ${f.label}` });
    }
    case "ref":
      return z.string({ error: req }).min(1, req).max(40);
    case "date":
      return z.coerce.date({ error: `${f.label} must be a valid date` });
    case "bool":
      return z.boolean({ error: `${f.label} must be yes or no` });
  }
}

/** Zod schema for a master's form values (shared by the form and the server). */
export function masterSchema(def: MasterDef) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of def.fields) {
    const base = baseSchema(f);
    if (f.type === "bool") {
      shape[f.name] = z.preprocess((v) => v ?? false, base);
      continue;
    }
    // Required blanks become undefined (not null) so z.coerce cannot turn them into 0 / 1970.
    shape[f.name] = f.required
      ? z.preprocess((v) => blankToNull(v) ?? undefined, base)
      : z.preprocess(blankToNull, base.nullable());
  }
  return z.object(shape);
}
