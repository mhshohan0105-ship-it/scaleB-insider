// Agency logo and seal image: GET shows it, POST (multipart "file") replaces it,
// DELETE removes it. Viewing needs only a signed-in user of the agency.
import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import {
  getAgencyImage,
  isImageKind,
  removeAgencyImage,
  saveAgencyImage,
} from "@/server/services/agency/brandingService";
import { ServiceError } from "@/server/services/errors";

type Params = { params: Promise<{ kind: string }> };

async function kindOf(params: Params["params"]) {
  const kind = (await params).kind.toUpperCase();
  return isImageKind(kind) ? kind : null;
}

export async function GET(_req: Request, { params }: Params) {
  const kind = await kindOf(params);
  if (!kind) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ctx = await toServiceContext(await getUserContext());
  const img = await getAgencyImage(ctx, kind);
  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(req: Request, { params }: Params) {
  const kind = await kindOf(params);
  if (!kind) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "edit"))
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  try {
    await saveAgencyImage(await toServiceContext(user), kind, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const kind = await kindOf(params);
  if (!kind) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "edit"))
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  await removeAgencyImage(await toServiceContext(user), kind);
  return NextResponse.json({ ok: true });
}
