# Deploying scaleB Insider

One Next.js server and one PostgreSQL 16 database. Uploaded files (passport scans, voucher
receipts) live in the database, so a database backup is a complete backup.

## 1. Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Signs session cookies. Generate with `npx auth secret`; changing it signs everyone out |
| `AUTH_TRUST_HOST` | yes | `true` when running behind a reverse proxy |
| `APP_URL` | yes | Public URL, e.g. `https://insider.example.com` |
| `CRON_SECRET` | yes | Long random string; scheduled jobs send it as `Authorization: Bearer <CRON_SECRET>` |
| `SMS_URL_TEMPLATE` | no | Gateway URL with `{to}`, `{text}`, `{key}`, `{sender}` placeholders. Empty = messages are logged, not sent |
| `SMS_METHOD` | no | `GET` (default) or `POST` (the template's query string is sent as a form body) |
| `SMS_API_KEY`, `SMS_SENDER_ID` | no | Substituted into the template |
| `SMS_SUCCESS_REGEX` | no | The gateway's response must match it to count as sent (otherwise any 2xx) |

Example for a typical Bangladeshi bulk SMS gateway:

```
SMS_URL_TEMPLATE="https://sms.example.com.bd/api/send?api_key={key}&senderid={sender}&number={to}&message={text}"
SMS_SUCCESS_REGEX="\"status\"\s*:\s*\"?(success|ok|202)"
```

Numbers are sent as `8801XXXXXXXXX`. Each agency still has to switch SMS on in
**Configuration → App Config**.

## 2. On Vercel with a Neon database (no server to look after)

The repository is ready for Vercel: `vercel.json` pins the Singapore region (`sin1`) and the
two daily jobs, and the `vercel-build` script runs `prisma generate`, `prisma migrate deploy`
(over the direct connection) and `next build`.

1. Create a Neon project in **AWS Asia Pacific (Singapore)**.
2. In Vercel: **Add New → Project**, import the GitHub repository, keep the detected Next.js
   settings.
3. Connect the database: in the Vercel project, **Storage → Connect Database → Neon** (or the
   Neon integration). It adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct). If
   you paste the strings by hand instead, set `DATABASE_URL` to the **pooled** string and
   `DIRECT_URL` to the direct one. The app adds `pgbouncer=true` and a wake-up timeout to a pooled
   Neon URL by itself.
4. Add the other variables (Settings → Environment Variables, Production): `AUTH_SECRET`,
   `AUTH_TRUST_HOST=true`, `APP_URL` (the site address), `CRON_SECRET`, and `SMS_*` if used.
   Vercel sends `Authorization: Bearer $CRON_SECRET` to the cron routes, which is what they check.
5. Deploy. The first build creates every table.
6. From your own computer, create the first agency and the platform admin against the Neon
   **direct** connection string (section 5), with `DATABASE_URL` set to it in that terminal only.

Notes: Vercel's Hobby plan is for non-commercial use; a business needs Pro. The cron schedule in
`vercel.json` is in UTC (19:30 = 01:30 Dhaka, 03:00 = 09:00 Dhaka). Every push to `main`
redeploys. Database backups: Neon keeps a restore history (length depends on the plan); also
download the agency backup (Configuration → Database Backup) regularly.

## 3. With Docker

```bash
cp .env.example .env        # fill in POSTGRES_PASSWORD, AUTH_SECRET, APP_URL, CRON_SECRET, SMS_*
docker compose -f docker-compose.prod.yml up -d --build
```

- The app container runs `prisma migrate deploy` on every start, then the server on port 3000
  (bound to 127.0.0.1). Put Caddy or nginx in front for HTTPS.
- The `backup` container writes `./backups/scaleb-YYYYMMDD.dump` every night at 02:00 Dhaka time
  and keeps 14 days. Copy that folder off the server (rclone, S3 sync, …).
- Restore: `pg_restore -h <host> -U scaleb -d scaleb_insider --clean scaleb-YYYYMMDD.dump`.

## 4. Without Docker

```bash
npm ci
npx prisma migrate deploy
NEXT_OUTPUT=standalone npm run build   # self-contained server in .next/standalone
node .next/standalone/server.js       # copy .next/static into .next/standalone/.next/static first
```

Run it under systemd or pm2, and back up with `pg_dump -Fc` on a schedule.

## 5. First agency and platform admin

```bash
OWNER_PASSWORD='a-strong-password' npx tsx scripts/create-agency.ts acme "Acme Travels" owner "Owner Name"
npx tsx scripts/make-superadmin.ts acme owner
```

The platform admin sees **Platform admin** in the user menu (`/admin`): create agencies, change
plans, suspend or re-activate them, and open an agency as its owner for support. Every such
action is written to the audit log of the agency concerned. `--revoke` removes the right.

Do **not** run `prisma db seed` in production; it creates the demo agency.

## 6. Scheduled jobs

Call these with `Authorization: Bearer $CRON_SECRET` (any scheduler: cron, systemd timers,
a hosting platform's cron):

| Schedule (Asia/Dhaka) | Request | Does |
| --- | --- | --- |
| Daily 01:30 | `GET /api/cron/ledger-check` | Checks every agency's books balance and cached party balances match the ledger; notifies accountants on a mismatch |
| Daily 09:00 | `GET /api/cron/daily` | Passport expiry SMS reminders (once per 30 days per passport), clears old read notifications |

Example crontab (server clock in UTC):

```
30 19 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://insider.example.com/api/cron/ledger-check
0 3 * * *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://insider.example.com/api/cron/daily
```

## 7. Updating

```bash
docker compose -f docker-compose.prod.yml up -d --build   # migrations run on start
```

Take a manual `pg_dump` before any update that includes new migrations.
