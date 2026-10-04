"use client";

import { Button } from "antd";

/** Button used inside a server-rendered <Link> on profile headers. */
export function ProfileAction({ label, primary }: { label: string; primary?: boolean }) {
  return <Button type={primary ? "primary" : "default"}>{label}</Button>;
}
