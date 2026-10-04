"use client";

import { Table } from "antd";
import type { TableProps } from "antd";
import { PAGE_SIZES } from "@/lib/listParams";
import { useUrlParams } from "./useUrlParams";

export interface DataTableProps<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  columns: TableProps<T>["columns"];
  rowKey?: keyof T & string;
  loading?: boolean;
}

/** Table whose pagination lives in the URL, so the server does the paging. */
export function DataTable<T extends object>({
  rows,
  total,
  page,
  pageSize,
  columns,
  rowKey = "id" as keyof T & string,
  loading,
}: DataTableProps<T>) {
  const { setParams, pending } = useUrlParams();

  return (
    <Table<T>
      size="middle"
      rowKey={rowKey}
      dataSource={rows}
      columns={columns}
      loading={loading || pending}
      scroll={{ x: "max-content" }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: PAGE_SIZES.map(String),
        showTotal: (t, [from, to]) => `${from}-${to} of ${t}`,
      }}
      onChange={(p) => {
        setParams({ page: p.current ?? 1, pageSize: p.pageSize ?? pageSize }, false);
      }}
    />
  );
}
