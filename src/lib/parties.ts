// Parties (PLAN.md 5 "Parties", 6.14): clients, combined clients, vendors and
// agents, described with the same definitions as the configuration masters.
import type { FieldDef, FieldOption, MasterDef, PartyKey } from "./masters";

/** Opening balance direction as the user sees it, per party kind. */
function openingFields(
  receivableLabel: string,
  payableLabel: string,
  defaultType: string,
): FieldDef[] {
  return [
    {
      name: "openingBalance",
      label: "Opening balance",
      type: "money",
      required: true,
      defaultValue: "0",
      listed: false,
      help: "Balance carried over from before you started using scaleB Insider.",
    },
    {
      name: "openingBalanceType",
      label: "Opening balance is",
      type: "select",
      required: true,
      defaultValue: defaultType,
      listed: false,
      options: [
        { value: "RECEIVABLE", label: receivableLabel },
        { value: "PAYABLE", label: payableLabel },
      ],
    },
  ];
}

const contactFields: FieldDef[] = [
  { name: "phone", label: "Phone", type: "text", max: 30 },
  { name: "email", label: "Email", type: "email", listed: false },
  { name: "address", label: "Address", type: "textarea", max: 300, listed: false },
];

const noteField: FieldDef = {
  name: "note",
  label: "Note",
  type: "textarea",
  max: 1000,
  listed: false,
};

export const CLIENT_TYPE_OPTIONS: readonly FieldOption[] = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "CORPORATE", label: "Corporate" },
];

export const VENDOR_TYPE_OPTIONS: readonly FieldOption[] = [
  { value: "AIRLINE", label: "Airline" },
  { value: "AIRLINE_CONSOLIDATOR", label: "Ticket consolidator" },
  { value: "GDS", label: "GDS" },
  { value: "VISA", label: "Visa processing" },
  { value: "HOTEL", label: "Hotel" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "OTHER", label: "Other" },
];

export interface ProfileTab {
  key: string;
  label: string;
  /** Build phase that fills this tab. */
  phase: number;
}

export interface PartyDef extends MasterDef {
  key: PartyKey;
  /** Tabs on the profile page after "Info". */
  profileTabs: ProfileTab[];
}

export const PARTIES: Record<PartyKey, PartyDef> = {
  clients: {
    key: "clients",
    model: "client",
    title: "Clients",
    singular: "Client",
    module: "clients",
    codePrefix: "CL",
    balance: true,
    profileBase: "/clients",
    fields: [
      { name: "name", label: "Client name", type: "text", required: true, max: 120 },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: CLIENT_TYPE_OPTIONS,
        defaultValue: "INDIVIDUAL",
      },
      ...contactFields.slice(0, 1),
      {
        name: "categoryId",
        label: "Category",
        type: "ref",
        ref: "clientcategories",
        relation: "category",
      },
      {
        name: "companyId",
        label: "Company",
        type: "ref",
        ref: "companies",
        relation: "company",
        listed: false,
        help: "For corporate clients.",
      },
      ...contactFields.slice(1),
      {
        name: "walkingCustomer",
        label: "Walk-in customer",
        type: "bool",
        defaultValue: false,
        listed: false,
        help: "One-off customers with no running account.",
      },
      {
        name: "creditLimit",
        label: "Credit limit",
        type: "money",
        required: true,
        defaultValue: "0",
        listed: false,
        help: "0 means no limit.",
      },
      ...openingFields("Client owes us (due)", "We owe the client (advance)", "RECEIVABLE"),
      noteField,
    ],
    searchFields: ["code", "name", "phone", "email"],
    orderBy: "name",
    profileTabs: [
      { key: "ledger", label: "Ledger", phase: 4 },
      { key: "invoices", label: "Invoices", phase: 4 },
      { key: "receipts", label: "Money receipts", phase: 4 },
      { key: "passports", label: "Passports", phase: 10 },
    ],
  },
  combinedclients: {
    key: "combinedclients",
    model: "combinedClient",
    title: "Combined Clients",
    singular: "Combined Client",
    description: "Parties you both sell to and buy from, kept on a single ledger.",
    module: "clients",
    codePrefix: "CC",
    balance: true,
    profileBase: "/clients/combined",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 120 },
      { name: "contactPerson", label: "Contact person", type: "text", max: 120 },
      ...contactFields,
      {
        name: "clientId",
        label: "Client account",
        type: "ref",
        ref: "clients",
        relation: "client",
        listed: false,
        help: "Invoices for this party are made to this client. Leave empty to create one with the same name.",
      },
      {
        name: "vendorId",
        label: "Vendor account",
        type: "ref",
        ref: "vendors",
        relation: "vendor",
        listed: false,
        help: "Purchases from this party are made from this vendor. Leave empty to create one with the same name.",
      },
      ...openingFields("They owe us", "We owe them", "RECEIVABLE"),
      noteField,
    ],
    searchFields: ["code", "name", "contactPerson", "phone", "email"],
    orderBy: "name",
    // Receivable (client side) and payable (vendor side) stay separate in the
    // books; the list and profile show the net of the three.
    netWithRefs: ["client", "vendor"],
    profileTabs: [
      { key: "ledger", label: "Ledger", phase: 4 },
      { key: "invoices", label: "Invoices", phase: 12 },
      { key: "purchases", label: "Purchases", phase: 12 },
      { key: "receipts", label: "Money receipts", phase: 12 },
      { key: "payments", label: "Payments", phase: 12 },
      { key: "setoffs", label: "Set-offs", phase: 12 },
    ],
  },
  vendors: {
    key: "vendors",
    model: "vendor",
    title: "Vendors",
    singular: "Vendor",
    description: "Airlines, consolidators, embassies, hotels and other suppliers.",
    module: "vendors",
    codePrefix: "VN",
    balance: true,
    profileBase: "/vendors",
    fields: [
      { name: "name", label: "Vendor name", type: "text", required: true, max: 120 },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: VENDOR_TYPE_OPTIONS,
        defaultValue: "OTHER",
      },
      ...contactFields.slice(0, 1),
      { name: "contactPerson", label: "Contact person", type: "text", max: 120 },
      ...contactFields.slice(1),
      {
        name: "commissionPercent",
        label: "Default commission %",
        type: "percent",
        required: true,
        defaultValue: "0",
        listed: false,
      },
      {
        name: "bankInfo",
        label: "Bank details",
        type: "textarea",
        max: 500,
        listed: false,
        help: "Bank, branch and account for payments.",
      },
      ...openingFields("Vendor owes us (advance paid)", "We owe the vendor (payable)", "PAYABLE"),
      noteField,
    ],
    searchFields: ["code", "name", "contactPerson", "phone", "email"],
    orderBy: "name",
    profileTabs: [
      { key: "ledger", label: "Ledger", phase: 4 },
      { key: "purchases", label: "Purchases", phase: 4 },
      { key: "payments", label: "Payments", phase: 4 },
    ],
  },
  agents: {
    key: "agents",
    model: "agent",
    title: "Agent Profiles",
    singular: "Agent",
    description: "People who bring you clients for a commission.",
    module: "agents",
    codePrefix: "AG",
    balance: true,
    profileBase: "/agents",
    fields: [
      { name: "name", label: "Agent name", type: "text", required: true, max: 120 },
      ...contactFields.slice(0, 1),
      {
        name: "commissionPercent",
        label: "Commission %",
        type: "percent",
        required: true,
        defaultValue: "0",
      },
      ...contactFields.slice(1),
      ...openingFields("Agent owes us", "We owe the agent (commission)", "PAYABLE"),
      noteField,
    ],
    searchFields: ["code", "name", "phone", "email"],
    orderBy: "name",
    profileTabs: [
      { key: "ledger", label: "Ledger", phase: 4 },
      { key: "invoices", label: "Referred invoices", phase: 4 },
      { key: "payments", label: "Commission payments", phase: 9 },
    ],
  },
};
