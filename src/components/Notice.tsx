"use client";

import { Alert } from "antd";

/** Simple message box usable from server components. */
export function Notice({
  type = "info",
  message,
}: {
  type?: "info" | "warning" | "error" | "success";
  message: string;
}) {
  return <Alert type={type} showIcon message={message} />;
}
