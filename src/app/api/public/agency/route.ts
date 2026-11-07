// Sign-in page: name of the agency behind a typed code, and whether it has a logo.
import { NextResponse } from "next/server";
import { publicAgencyCard } from "@/server/services/agency/brandingService";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{1,38}$/i.test(code.trim()))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const card = await publicAgencyCard(code);
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    {
      name: card.name,
      logo: card.logo
        ? `/api/public/agency/logo?code=${encodeURIComponent(code.trim().toLowerCase())}&v=${card.logo.updatedAt.getTime()}`
        : null,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
