import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getAttachment } from "@/server/services/attachments/attachmentService";

/** Download an attachment; needs view permission on its document's module. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  const found = await getAttachment(await toServiceContext(user), id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!found.module || !can(user.permissions, found.module, "view"))
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { file } = found;
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
