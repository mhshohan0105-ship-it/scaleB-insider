# Deploying scaleB Insider

One Next.js server and one MariaDB 10.11 (or MySQL 8) database. Uploaded files (passport scans, voucher
receipts) live in the database, so a database backup is a complete backup.

## 1. Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `mysql://user:password@host:3306/database` (URL-encode special characters in the password) |
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

## 2. On cPanel shared hosting (Setup Node.js App + MariaDB)

Tested target: CloudLinux cPanel with LiteSpeed, "Setup Node.js App" (Node 24) and MariaDB 10.11.
The host builds nothing (1 GB RAM is too little for `next build`): the app is built on a
computer and the built files are uploaded.

1. **Subdomain:** cPanel → Domains → Create A New Domain → `insider.example.com`, untick
   "Share document root". Run AutoSSL (SSL/TLS Status) for it.
2. **Database:** cPanel → Manage My Databases: create a database and a user, give the user ALL
   PRIVILEGES on it. `DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DBNAME`.
3. **Tables and the first agency**, either:
   - from your computer: cPanel → Remote Database Access, add your IP, then with `DATABASE_URL`
     pointing at the host (`mysql://USER:PASSWORD@<host>:3306/DBNAME`) run
     `npx prisma migrate deploy` and the commands in section 5; or
   - in phpMyAdmin: import `prisma/migrations/*/migration.sql` (in order), and create the agency
     later from your computer the same way.
4. **Build** on your computer: `npm ci`, then `NEXT_OUTPUT=standalone npm run build`. Copy
   `.next/static` to `.next/standalone/.next/static`. Upload the contents of
   `.next/standalone` (zip, File Manager → Upload → Extract) into the app folder, e.g.
   `/home/USER/insider`. The Prisma client includes the Linux engines (`binaryTargets` in
   `schema.prisma`).
5. **Node.js App:** cPanel → Setup Node.js App → Create Application: Node 24, mode Production,
   application root = the app folder, URL = the subdomain, startup file `server.js`. Add the
   environment variables from section 1 (and `NODE_ENV=production`, `HOSTNAME=127.0.0.1`).
   Start the app.
6. **Scheduled jobs:** cPanel → Cron Jobs, the two `curl` lines of section 6 (server clock may
   not be UTC: check the time shown on the Cron Jobs page).

Updates: build again, upload, then Restart in Setup Node.js App. Apply new migrations first
(step 3). Backups: cPanel/JetBackup plus Configuration → Database Backup in the app.

## 3. With Docker

```bash
cp .env.example .env        # fill in DB_PASSWORD, DB_ROOT_PASSWORD, AUTH_SECRET, APP_URL, CRON_SECRET, SMS_*
docker compose -f docker-compose.prod.yml up -d --build
```

- The app container runs `prisma migrate deploy` on every start, then the server on port 3000
  (bound to 127.0.0.1). Put Caddy or nginx in front for HTTPS.
- The `backup` container writes `./backups/scaleb-YYYYMMDD.sql.gz` every night at 02:00 Dhaka time
  and keeps 14 days. Copy that folder off the server (rclone, S3 sync, …).
- Restore: `gunzip -c scaleb-YYYYMMDD.sql.gz | mariadb -h <host> -u scaleb -p scaleb_insider`.

## 4. Without Docker

```bash
npm ci
npx prisma migrate deploy
NEXT_OUTPUT=standalone npm run build   # self-contained server in .next/standalone
node .next/standalone/server.js       # copy .next/static into .next/standalone/.next/static first
```

Run it under systemd or pm2, and back up with `mariadb-dump --single-transaction` on a schedule.

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

Take a manual `mariadb-dump` before any update that includes new migrations.

The PostgreSQL edition of the app (for Vercel + Neon) is kept on the `postgres` branch.
