"use client";

import { useEffect, useRef, useState } from "react";
import { Select, Spin, Typography } from "antd";
import type { PartyKey } from "@/lib/masters";
import { searchEntityAction } from "@/app/(app)/entityActions";

interface Option {
  value: string;
  label: string;
  phone?: string | null;
}

interface PartySelectProps {
  party: PartyKey;
  value?: string | null;
  onChange?: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  id?: string;
}

/**
 * Searchable picker for clients, vendors, agents or combined clients. Searches
 * on the server (name, code, phone, email), so it scales to large party lists.
 */
export function PartySelect({
  party,
  value,
  onChange,
  placeholder = "Search by name, code or phone",
  disabled,
  allowClear = true,
  id,
}: PartySelectProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function load(q: string) {
    const ticket = ++request.current;
    setLoading(true);
    void searchEntityAction(party, q, value).then((r) => {
      if (ticket !== request.current) return; // a newer search superseded this one
      setLoading(false);
      if (r.ok) setOptions(r.data);
    });
  }

  useEffect(() => {
    load("");
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party]);

  return (
    <Select<string>
      id={id}
      showSearch
      allowClear={allowClear}
      disabled={disabled}
      value={value ?? undefined}
      placeholder={placeholder}
      filterOption={false}
      notFoundContent={loading ? <Spin size="small" /> : "No match"}
      onSearch={(q) => {
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
      style={{ width: "100%" }}
    />
  );
}
