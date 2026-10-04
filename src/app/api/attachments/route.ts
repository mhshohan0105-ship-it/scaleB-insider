import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import {
  addAttachment,
  attachmentModule,
  type AttachmentTarget,
} from "@/server/services/attachments/attachmentService";
import { ServiceError } from "@/server/services/errors";

/** Upload a file (multipart "file"): POST /api/attachments?voucherId=... or ?passportId=... */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const target: AttachmentTarget | null = q.get("voucherId")
    ? { voucherId: q.get("voucherId")! }
    : q.get("passportId")
      ? { passportId: q.get("passportId")! }
      : null;
  if (!target) return NextResponse.json({ error: "Nothing to attach to" }, { status: 400 });
  const user = await getUserContext();
  const ctx = await toServiceContext(user);
  const moduleKey = await attachmentModule(ctx, target);
  if (!moduleKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(user.permissions, moduleKey, "create") && !can(user.permissions, moduleKey, "edit"))
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  try {
    const saved = await addAttachment(ctx, target, {
      name: file.name,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json(saved);
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
