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

Live at `insider.scalebbd.com` (Intelwebhost: CloudLinux cPanel, LiteSpeed, Node 24, MariaDB 10.11,
1 GB RAM, server clock on Asia/Dhaka). The host builds nothing; the app is built on a computer and
the built files are uploaded.

1. **Subdomain:** Domains → Create A New Domain, untick "Share document root". The account's
   wildcard certificate (`*.scalebbd.com`) already covers it.
2. **Database:** Manage My Databases → database + user (ALL PRIVILEGES). The MySQL port is closed
   to the outside, so Remote Database Access does not help: tables are created by import.
3. **Tables (first install only):** in phpMyAdmin import the new migration SQL plus the
   `_prisma_migrations` row and the data of a local staging database (tables in their exact
   PascalCase names; Windows MariaDB lower-cases them, so take the DDL from the migration file).
   Create the agency in that staging database first with `scripts/create-agency.ts`.
4. **Build** on the computer: `NEXT_OUTPUT=standalone NEXT_DIST_DIR=.next-deploy npx next build`,
   copy `.next-deploy/static` into `.next-deploy/standalone/.next-deploy/static`, **delete
   `.next-deploy/standalone/.env`** (the build copies the local one), drop `*win32*` and
   `*windows.dll.node`. Upload in zips under 10 MB into `/home/USER/insider-app` and extract.
5. **Node.js App:** Node 24, Production, root `insider-app`, URL the subdomain, startup
   `server.js`. Environment variables:
   - `DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DBNAME`, `AUTH_SECRET`, `CRON_SECRET`
     (secrets: typed by the owner),
   - `AUTH_TRUST_HOST=true`, `APP_URL` and `AUTH_URL` = `https://insider.example.com` (without
     `AUTH_URL` redirects point at the internal `0.0.0.0:3000`),
   - `PRISMA_QUERY_ENGINE_LIBRARY=/home/USER/insider-app/node_modules/.prisma/client/libquery_engine-rhel-openssl-1.1.x.so.node`
     (Prisma misdetects this CloudLinux as debian-openssl-1.1.x; both targets are now built),
   - `TOKIO_WORKER_THREADS=2` and `UV_THREADPOOL_SIZE=2`: the account may run 100 processes and
     threads in all, and Prisma's engine otherwise starts one thread per server core; past the
     limit it panics ("OS can't spawn worker thread"), which shows as 503 or a client-side error.
   - The password inside `DATABASE_URL` must be URL-encoded (`@` → `%40`, `#` → `%23`); simplest
     is a database password of letters and digits only.
   Click **Save**, then **Restart**. Errors go to `insider-app/stderr.log`.
   If pages come back empty (200 with no body) or static files give 503 while `/api/auth/session`
   works, old `next-server` processes are still serving (Resource Usage shows memory near 1 GB
   even with the app stopped; Stop/Restart does not end them). End them with a one-off cron line
   `pkill -u USER -f next-server`, remove the line after a minute, then Start the app.
6. **Scheduled jobs:** Cron Jobs, server clock is Dhaka time:
   `30 1 * * *` ledger check, `0 2 * * *` backup and `0 9 * * *` daily, each
   `curl -fsS -H "Authorization: Bearer CRON_SECRET" https://insider.example.com/api/cron/<job> > /dev/null 2>&1`.

7. **Backups to Google Drive (once):** in Google Cloud Console (console.cloud.google.com, signed in
   with the Google account that should hold the backups):
   1. Create a project, then APIs & Services > Library > **Google Drive API** > Enable.
   2. OAuth consent screen: External, app name "scaleB Insider backups", your email; add the scope
      `.../auth/drive.file`; then **Publish app** (in Testing mode Google drops the sign-in after
      7 days).
   3. Credentials > Create credentials > OAuth client ID > **Web application**, authorised redirect
      URI `https://insider.example.com/api/admin/backups/google`.
   4. In the app: user menu > Database backups, paste the Client ID and secret, Save, then
      **Connect Google Drive** and allow access. Download the **recovery key** and keep it off the
      server: without it no backup can be opened.
   A backup opens with `npx tsx scripts/open-backup.ts <file> <key file>`; import the `.sql` in
   phpMyAdmin (into an empty database).

**Updates:** build again (step 4), upload and extract over the old files, apply any new migration
SQL in phpMyAdmin first, then Restart. Backups: JetBackup in cPanel plus Configuration → Database
Backup in the app.

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
