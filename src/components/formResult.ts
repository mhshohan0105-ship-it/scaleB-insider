"use client";

import type { FormInstance } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import type { ActionResult } from "@/lib/actionResult";

/** "tickets.0.ticketNo" -> ["tickets", 0, "ticketNo"] (Form.List uses numeric indexes). */
function toNamePath(key: string): (string | number)[] {
  return key.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

/**
 * Shows a server action result on an antd form: field errors on their fields,
 * the summary as a toast. Returns true on success.
 */
export function applyActionResult<T>(
  result: ActionResult<T>,
  form: FormInstance | null,
  message: MessageInstance,
  successText?: string,
): result is { ok: true; data: T } {
  if (result.ok) {
    if (successText) message.success(successText);
    return true;
  }
  if (form && result.fieldErrors) {
    const known = Object.entries(result.fieldErrors).filter(([name]) => name !== "_");
    form.setFields(known.map(([name, error]) => ({ name: toNamePath(name), errors: [error] })));
  }
  message.error(result.error);
  return false;
}
