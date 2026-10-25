// Google Drive connection for backups (platform administrators only).
//   GET ?start=1          -> sends the admin to Google's consent screen
//   GET ?code=..&state=.. -> Google's redirect back; stores the refresh token
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getUserContext } from "@/server/auth/session";
import {
  finishGoogleConnect,
  googleConsentUrl,
  googleRedirectUri,
} from "@/server/services/backup/platformBackup";

const STATE_COOKIE = "scaleb-drive-state";

function back(error?: string) {
  const url = new URL("/admin/backups", googleRedirectUri());
  if (error) url.searchParams.set("driveError", error.slice(0, 200));
  else url.searchParams.set("drive", "connected");
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const user = await getUserContext();
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const actor = { userId: user.userId, agencyId: user.agencyId, name: user.name };
  const params = req.nextUrl.searchParams;
  const jar = await cookies();

  if (params.get("start")) {
    const state = randomBytes(24).toString("base64url");
    try {
      const url = await googleConsentUrl(actor, state);
      jar.set(STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/admin/backups/google",
        maxAge: 600,
      });
      return NextResponse.redirect(url);
    } catch (e) {
      return back((e as Error).message);
    }
  }

  const expected = Buffer.from(jar.get(STATE_COOKIE)?.value ?? "");
  const given = Buffer.from(params.get("state") ?? "");
  jar.delete(STATE_COOKIE);
  if (params.get("error")) return back(`Google: ${params.get("error")}`);
  if (!expected.length || expected.length !== given.length || !timingSafeEqual(expected, given))
    return back("The sign-in link expired. Click Connect again.");
  try {
    await finishGoogleConnect(actor, params.get("code") ?? "");
    return back();
  } catch (e) {
    return back((e as Error).message);
  }
}
