// Minimal Google Drive client for backups (OAuth 2.0 web flow, REST v3).
// Scope drive.file: the app sees only the files it created itself, never the
// rest of the owner's Drive.
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file openid email";
export const DRIVE_FOLDER_NAME = "scaleB Insider backups";

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function call<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Drive ${what} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function authUrl(c: GoogleClient, state: string): string {
  const q = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${q}`;
}

/** Exchanges the consent code for a refresh token and the account's email. */
export async function finishAuth(c: GoogleClient, code: string) {
  const t = await call<{ access_token: string; refresh_token?: string }>(
    await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: c.clientId,
        client_secret: c.clientSecret,
        redirect_uri: c.redirectUri,
        grant_type: "authorization_code",
      }),
    }),
    "sign-in",
  );
  if (!t.refresh_token)
    throw new Error("Google did not return a refresh token. Remove the app's access and try again.");
  const me = await call<{ email?: string }>(
    await fetch(USERINFO, { headers: { authorization: `Bearer ${t.access_token}` } }),
    "account lookup",
  );
  return { refreshToken: t.refresh_token, email: me.email ?? null };
}

export async function accessToken(c: Omit<GoogleClient, "redirectUri">, refreshToken: string) {
  const t = await call<{ access_token: string }>(
    await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    }),
    "token refresh",
  );
  return t.access_token;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

/** The backup folder (created when missing or trashed). */
export async function ensureFolder(token: string, folderId: string | null): Promise<string> {
  if (folderId) {
    const res = await fetch(`${FILES}/${encodeURIComponent(folderId)}?fields=id,trashed`, {
      headers: auth(token),
    });
    if (res.ok && !((await res.json()) as { trashed?: boolean }).trashed) return folderId;
  }
  const f = await call<{ id: string }>(
    await fetch(`${FILES}?fields=id`, {
      method: "POST",
      headers: { ...auth(token), "content-type": "application/json" },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    }),
    "folder create",
  );
  return f.id;
}

export async function uploadFile(token: string, folderId: string, name: string, data: Buffer) {
  const boundary = `scaleb${Date.now().toString(36)}`;
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const f = await call<{ id: string }>(
    await fetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { ...auth(token), "content-type": `multipart/related; boundary=${boundary}` },
      body,
    }),
    "upload",
  );
  return f.id;
}

export async function listFiles(token: string, folderId: string) {
  const out: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await call<{ files: { id: string; name: string }[]; nextPageToken?: string }>(
      await fetch(`${FILES}?${q}`, { headers: auth(token) }),
      "list",
    );
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

export async function deleteFile(token: string, id: string) {
  await call<void>(
    await fetch(`${FILES}/${encodeURIComponent(id)}`, { method: "DELETE", headers: auth(token) }),
    "delete",
  );
}
