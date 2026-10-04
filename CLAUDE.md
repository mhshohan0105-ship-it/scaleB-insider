# CLAUDE.md: scaleB Insider

Travel agency management and accounting SaaS (Next.js full stack). Full spec: `PLAN.md`. Read it before every phase.

## How to work

- Build strictly phase by phase (PLAN.md section 11). Finish acceptance checks before moving on.
- At the start of a phase: restate the phase scope, list files you will create, then build.
- At the end of a phase: run `npm run check`, fix everything, append to `CHANGELOG.md`.
- If a business rule is unclear, check PLAN.md section 14 and ask instead of guessing.
- All code, UI text and design must be original. Do not copy other products' code, text or assets.

## Stack

Next.js 15 App Router, TypeScript strict, Ant Design v5, Prisma + PostgreSQL, Auth.js v5 (credentials), Zod, Vitest, Playwright, @react-pdf/renderer, exceljs.

## Commands

- Postgres: native PostgreSQL 16 on localhost:5432 (dev machine). `docker compose up -d` is the alternative where Docker is available.
- `npm run dev` dev server
- `npx prisma migrate dev` / `npx prisma db seed`
- `npm run check` lint + typecheck + unit tests
- `npm run test:e2e` Playwright

## Hard rules

1. Money: `Decimal(14,2)` in DB, `Prisma.Decimal` in code. Never JS floats for money.
2. Only `src/server/accounting/post.ts` writes `JournalEntry`/`JournalLine`. Debits must equal credits.
3. Never edit or delete posted journal lines. Edits = reverse + repost. Documents are voided, not deleted.
4. Every money mutation runs inside `prisma.$transaction`.
5. Every query goes through the tenant scoped Prisma client (`agencyId` enforced). No raw unscoped queries.
6. Business logic lives in `src/server/services/*`. Pages and server actions only validate (Zod), check permission (`can()`), call a service.
7. Every create/update/void writes an `AuditLog`.
8. Store dates in UTC, display in Asia/Dhaka. Currency default BDT.
9. Calculation functions (air ticket, refund, allocation) are pure and unit tested.
10. List pages are server side paginated and filtered.

## Conventions

- Route folders lowercase without separators (`invoices/airticket`).
- Components PascalCase, services camelCase functions, one domain per folder.
- Zod schemas in `src/lib/schemas/<domain>.ts`, shared by form and server.
- Reusable UI: `DataTable`, `MoneyInput`, `PartySelect`, `DateRangeFilter`, `PrintLayout`, `ReportShell` (filters + table + totals + export).
