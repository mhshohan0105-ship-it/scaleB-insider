"use client";

import type { PartyKey } from "@/lib/masters";
import { EntitySelect, type EntitySelectProps } from "@/components/select/EntitySelect";

interface PartySelectProps extends Omit<EntitySelectProps, "entity" | "options"> {
  party: PartyKey;
}

/**
 * Searchable picker for clients, vendors, agents or combined clients. Searches
 * on the server (name, code, phone, email), so it scales to large party lists,
 * and can add a new party from the list.
 */
export function PartySelect({
  party,
  placeholder = "Search by name, code or phone",
  ...rest
}: PartySelectProps) {
  return <EntitySelect entity={party} placeholder={placeholder} {...rest} />;
}
