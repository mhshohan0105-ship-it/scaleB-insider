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

## 2. With Docker (recommended)

```bash
cp .env.example .env        # fill in POSTGRES_PASSWORD, AUTH_SECRET, APP_URL, CRON_SECRET, SMS_*
docker compose -f docker-compose.prod.yml up -d --build
```

- The app container runs `prisma migrate deploy` on every start, then the server on port 3000
  (bound to 127.0.0.1). Put Caddy or nginx in front for HTTPS.
- The `backup` container writes `./backups/scaleb-YYYYMMDD.dump` every night at 02:00 Dhaka time
  and keeps 14 days. Copy that folder off the server (rclone, S3 sync, …).
- Restore: `pg_restore -h <host> -U scaleb -d scaleb_insider --clean scaleb-YYYYMMDD.dump`.

## 3. Without Docker

```bash
npm ci
npx prisma migrate deploy
npm run build
node .next/standalone/server.js   # copy .next/static into .next/standalone/.next/static first
```

Run it under systemd or pm2, and back up with `pg_dump -Fc` on a schedule.

## 4. First agency and platform admin

```bash
OWNER_PASSWORD='a-strong-password' npx tsx scripts/create-agency.ts acme "Acme Travels" owner "Owner Name"
npx tsx scripts/make-superadmin.ts acme owner
```

The platform admin sees **Platform admin** in the user menu (`/admin`): create agencies, change
plans, suspend or re-activate them, and open an agency as its owner for support. Every such
action is written to the audit log of the agency concerned. `--revoke` removes the right.

Do **not** run `prisma db seed` in production; it creates the demo agency.

## 5. Scheduled jobs

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

## 6. Updating

```bash
docker compose -f docker-compose.prod.yml up -d --build   # migrations run on start
```

Take a manual `pg_dump` before any update that includes new migrations.
