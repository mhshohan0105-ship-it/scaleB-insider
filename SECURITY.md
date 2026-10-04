# Security notes

What protects each agency's data, and what to keep in mind when changing the code
(Phase 12 security review).

## Tenancy

- Every tenant table has `agencyId`. All queries go through `tenantDb(agencyId)`
  (`src/server/db/tenant.ts`), which adds the agency filter to reads and writes and sets it on
  creates, for every model that has the column (derived from the Prisma schema, so new tables
  are covered automatically).
- Raw SQL (reports, balances) always binds `agencyId` as a parameter. Never interpolate.
- The only code that uses the unscoped client is: sign-in, agency provisioning, the platform admin
  service, cron jobs looping over agencies, and seed/scripts. Each says so in its header.
- Integration tests create a second agency and check it sees nothing of the first.

## Authentication

- Passwords are bcrypt hashed. Five failed sign-ins lock the account for 15 minutes; every attempt
  is written to `LoginHistory`.
- Sessions are signed JWT cookies (`AUTH_SECRET`). The user, role and agency are re-read from the
  database on every request, so deactivating a user, suspending an agency or changing a role takes
  effect immediately.
- **Impersonation** ("Open as owner"): only users with `isSuperAdmin`. The admin gets a random
  one-time token (only its SHA-256 is stored, valid 2 minutes, single use) that signs in as the
  agency's owner. The session carries the admin's name, a banner is shown on every page, and an
  `IMPERSONATE` audit row is written in the target agency.

## Authorisation

- Every server action authenticates the caller (`requirePermission`, `getUserContext`, or the
  admin actor) before anything else; `src/app/actionGuards.test.ts` fails the build when a new
  action does not. Pages check `can()` and show *Access denied*.
- Route handlers (`/api/...`) check the session and permission themselves; cron routes compare
  `CRON_SECRET` in constant time and refuse when it is unset.
- Sensitive reports (profit, salaries) have their own permission check (`canRunReport`).

## Data integrity

- Money is `Decimal(14,2)`; journal entries are only written by `post.ts`, which refuses
  unbalanced entries. Posted lines are never edited; corrections are reversals.
- A nightly job re-checks that every agency's ledger balances and that cached balances match.
- Every create/update/void writes an `AuditLog` row with before/after values.

## Input and output

- All input is validated with Zod on the server (the same schemas as the forms).
- Uploads: 2 MB limit, PDF / JPEG / PNG / WebP only, served with the stored content type and
  `Content-Disposition`, from the database (no files on disk).
- React escapes output; the app has no `dangerouslySetInnerHTML`.
- Response headers (`next.config.ts`): `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, and HSTS in production. `X-Powered-By` is off.

## Operations

- Keep `AUTH_SECRET`, `CRON_SECRET`, the database password and SMS keys out of the repository.
- Serve only over HTTPS. The Docker setup binds the app to 127.0.0.1 behind a TLS proxy.
- Back up the database daily and test a restore (DEPLOYMENT.md).
- Report a vulnerability privately to the maintainers rather than in a public issue.
