"use client";

import { useEffect, useState } from "react";
import { Typography } from "antd";
import { formatDateTime } from "@/lib/format";

/** Current Dhaka date/time. Renders only after mount to avoid hydration mismatch. */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;
  return (
    <Typography.Text type="secondary" style={{ whiteSpace: "nowrap" }}>
      {formatDateTime(now)}
    </Typography.Text>
  );
}
