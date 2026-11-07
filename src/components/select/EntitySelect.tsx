"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Divider, Select, Spin, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ENTITIES, entityModule } from "@/lib/entities";
import type { EntityKey } from "@/lib/masters";
import { useCan } from "@/components/PermissionsProvider";
import { searchEntityAction } from "@/app/(app)/entityActions";
import { QuickCreateModal } from "./QuickCreateModal";

/** Any list a picker can add to: the entity engine's lists, plus money accounts. */
export type CreatableKey = EntityKey | "moneyaccounts";

export interface PickOption {
  value: string;
  label: string;
  phone?: string | null;
  /** Money accounts: CASH, BANK, ... */
  kind?: string;
}

export interface EntitySelectProps {
  entity: CreatableKey;
  /** Pick from these (small lists loaded by the page). Without them the server is searched. */
  options?: PickOption[];
  value?: string | null;
  onChange?: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  id?: string;
  /** Show "+ Add new ..." at the bottom of the list (default true). Off for filters. */
  creatable?: boolean;
  /** Called with a row added from the picker, before it is selected. */
  onCreated?: (option: PickOption) => void;
}

export function singularOf(entity: CreatableKey): string {
  return entity === "moneyaccounts" ? "Account" : ENTITIES[entity].singular;
}

function useCanCreate(entity: CreatableKey) {
  return useCan(entity === "moneyaccounts" ? "accounts" : entityModule(ENTITIES[entity]), "create");
}

/**
 * Picker for any configurable list (clients, vendors, airlines, accounts, ...)
 * with "+ Add new" at the bottom: the row is created in a pop-up and selected
 * at once, without leaving the form. Shown only to users who may create it.
 */
export function EntitySelect({
  entity,
  options: given,
  value,
  onChange,
  placeholder,
  disabled,
  allowClear = true,
  id,
  creatable = true,
  onCreated,
}: EntitySelectProps) {
  const router = useRouter();
  const searchServer = !given;
  const [found, setFound] = useState<PickOption[]>([]);
  const [created, setCreated] = useState<PickOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const canCreate = useCanCreate(entity) && creatable;

  function load(q: string) {
    if (!searchServer || entity === "moneyaccounts") return;
    const ticket = ++request.current;
    setLoading(true);
    void searchEntityAction(entity, q, value).then((r) => {
      if (ticket !== request.current) return; // a newer search superseded this one
      setLoading(false);
      if (r.ok) setFound(r.data);
    });
  }

  useEffect(() => {
    load("");
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const base = given ?? found;
  const options = [...base, ...created.filter((c) => !base.some((o) => o.value === c.value))];

  function added(option: PickOption) {
    setAdding(null);
    setCreated((c) => [...c.filter((o) => o.value !== option.value), option]);
    onCreated?.(option);
    onChange?.(option.value);
    // Page-loaded option lists (other pickers of the same list) pick it up too.
    router.refresh();
  }

  const singular = singularOf(entity).toLowerCase();
  const typed = search.trim();

  return (
    <>
      <Select<string>
        id={id}
        showSearch
        allowClear={allowClear}
        disabled={disabled}
        value={value ?? undefined}
        placeholder={placeholder}
        open={open}
        onOpenChange={setOpen}
        searchValue={search}
        filterOption={searchServer ? false : undefined}
        optionFilterProp="label"
        notFoundContent={loading ? <Spin size="small" /> : "No match"}
        onSearch={(q) => {
          setSearch(q);
          if (!searchServer) return;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => load(q), 250);
        }}
        onChange={(v) => onChange?.(v ?? null)}
        options={options.map((o) => ({
          value: o.value,
          label: o.label,
          title: o.label,
          phone: o.phone,
        }))}
        optionRender={(o) => (
          <span>
            {o.label}
            {o.data.phone && (
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {o.data.phone}
              </Typography.Text>
            )}
          </span>
        )}
        popupRender={(menu) =>
          canCreate ? (
            <>
              {menu}
              <Divider style={{ margin: "4px 0" }} />
              <Button
                type="text"
                block
                icon={<PlusOutlined />}
                style={{ textAlign: "left", justifyContent: "flex-start" }}
                // Keep focus in the select so the typed text is not cleared first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Leave the picker so a click on it after the pop-up opens it again.
                  (document.activeElement as HTMLElement | null)?.blur();
                  setOpen(false);
                  setSearch("");
                  setAdding(typed);
                }}
              >
                {typed ? `Add "${typed}" as new ${singular}` : `Add new ${singular}`}
              </Button>
            </>
          ) : (
            menu
          )
        }
        style={{ width: "100%" }}
      />
      {/* Mounted only while adding, so a form full of pickers carries no hidden forms. */}
      {canCreate && adding !== null && (
        <QuickCreateModal
          entity={entity}
          open
          typed={adding}
          onClose={() => setAdding(null)}
          onCreated={added}
        />
      )}
    </>
  );
}
