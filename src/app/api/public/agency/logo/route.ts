// Sign-in page: the logo of the agency behind a typed code.
import { NextResponse } from "next/server";
import { publicAgencyCard } from "@/server/services/agency/brandingService";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const card = /^[a-z0-9][a-z0-9-]{1,38}$/i.test(code.trim()) ? await publicAgencyCard(code) : null;
  if (!card?.logo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(card.logo.data), {
    headers: {
      "Content-Type": card.logo.mimeType,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
