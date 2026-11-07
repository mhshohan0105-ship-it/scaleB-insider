// The Settings home page: every configuration page, in sections, with one line
// on what it holds. Lists handled by the entity engine also show a count.
import { isMasterKey, type MasterKey } from "./masters";

export interface HubEntry {
  label: string;
  href: string;
  description: string;
  /** The list behind this page, when it has a row count. */
  countKey?: MasterKey;
}

export interface HubSection {
  title: string;
  entries: HubEntry[];
}

const entry = (label: string, slug: string, description: string): HubEntry => ({
  label,
  href: `/settings/${slug}`,
  description,
  ...(isMasterKey(slug) ? { countKey: slug } : {}),
});

export const SETTINGS_HUB: HubSection[] = [
  {
    title: "Agency",
    entries: [
      entry("Agency Profile", "profile", "Name, logo, address and what prints on invoices."),
      entry("Subscription", "subscription", "Your plan, what it includes and when it renews."),
      entry("App Config", "app", "Invoice numbers, AIT and commission rules, fiscal year, SMS."),
      entry("Users", "users", "Who can sign in, their passwords and roles."),
      entry("Roles", "roles", "What each role may see and do."),
    ],
  },
  {
    title: "Staff",
    entries: [
      entry("Employees", "employees", "Staff for sales, salaries and commission."),
      entry("Departments", "departments", "Departments employees belong to."),
      entry("Designations", "designations", "Job titles."),
    ],
  },
  {
    title: "Travel lists",
    entries: [
      entry("Airlines", "airlines", "Airlines with their commission defaults."),
      entry("Airports", "airports", "Airport codes used in routes."),
      entry("Countries", "countries", "Countries for visas and tours."),
      entry("Visa Types", "visatypes", "Tourist, work, student and so on."),
      entry("Room Types", "roomtypes", "Hotel room types."),
      entry("Transport Types", "transporttypes", "Bus, car, boat and so on."),
      entry("Tour Itinerary", "tour", "Tour groups and their costs."),
    ],
  },
  {
    title: "Clients and Hajj",
    entries: [
      entry("Client Categories", "clientcategories", "Groups to sort clients into."),
      entry("Companies", "companies", "Companies your corporate clients belong to."),
      entry("Products", "products", "Services you sell on invoices."),
      entry("Passport Status", "passportstatus", "Where a passport is in your process."),
      entry("Groups", "groups", "Hajj and Umrah groups."),
      entry("Maharam", "maharam", "Maharam relations for pilgrims."),
    ],
  },
  {
    title: "Data and messages",
    entries: [
      entry("SMS", "sms", "Send messages and see what was sent."),
      entry("Database Backup", "backup", "Download a copy of your agency's data."),
    ],
  },
];

/** Every list that shows a row count on the hub. */
export const HUB_COUNT_KEYS: MasterKey[] = SETTINGS_HUB.flatMap((s) =>
  s.entries.flatMap((e) => (e.countKey ? [e.countKey] : [])),
);
