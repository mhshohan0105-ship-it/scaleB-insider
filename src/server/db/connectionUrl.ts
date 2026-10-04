// Connection string the app uses at runtime. Neon's pooled endpoint (host
// contains "-pooler.") runs PgBouncer in transaction mode: Prisma must not
// rely on prepared statements there (pgbouncer=true), and a sleeping Neon
// compute needs a few seconds to wake (connect_timeout). Other URLs are
// returned unchanged.
export function runtimeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (!url.hostname.includes("-pooler.")) return raw;
  if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "15");
  return url.toString();
}
