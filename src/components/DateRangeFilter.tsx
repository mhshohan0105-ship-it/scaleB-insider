"use client";

import { DatePicker } from "antd";
import dayjs from "dayjs";
import { fiscalYear, todayIso } from "@/lib/dates";
import { useUrlParams } from "./useUrlParams";

/**
 * Date range kept in the URL as ?from=YYYY-MM-DD&to=YYYY-MM-DD, so list and
 * report pages filter on the server.
 */
export function DateRangeFilter({
  from,
  to,
  fiscalYearStart = 7,
}: {
  from?: string;
  to?: string;
  /** Month the fiscal year starts in (Bangladesh: July). */
  fiscalYearStart?: number;
}) {
  const { setParams } = useUrlParams();
  const fyFrom = dayjs(fiscalYear(todayIso(), fiscalYearStart).from);
  return (
    <DatePicker.RangePicker
      allowEmpty={[true, true]}
      format="DD MMM YYYY"
      value={[from ? dayjs(from) : null, to ? dayjs(to) : null]}
      presets={[
        { label: "Today", value: [dayjs(), dayjs()] },
        { label: "This month", value: [dayjs().startOf("month"), dayjs()] },
        {
          label: "Last month",
          value: [
            dayjs().subtract(1, "month").startOf("month"),
            dayjs().subtract(1, "month").endOf("month"),
          ],
        },
        { label: "This fiscal year", value: [fyFrom, dayjs()] },
        {
          label: "Last fiscal year",
          value: [fyFrom.subtract(1, "year"), fyFrom.subtract(1, "day")],
        },
        { label: "This calendar year", value: [dayjs().startOf("year"), dayjs()] },
      ]}
      onChange={(range) =>
        setParams({
          from: range?.[0]?.format("YYYY-MM-DD") ?? null,
          to: range?.[1]?.format("YYYY-MM-DD") ?? null,
        })
      }
    />
  );
}
