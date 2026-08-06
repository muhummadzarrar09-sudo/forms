# Project documentation

## Delivery and audit record

- `audits/handoff-audit.md` — historical pre-handoff security/data audit.
- `audits/forensic-backend-database-audit-2026-08-06.md` — current backend/database finding inventory.
- `audits/forensic-visual-ui-audit-2026-08-06.md` — visual-system audit.
- `audits/visual-remediation-2026-08-06.md` — visual remediation record.
- `planning/supabase-auth-postgres-cutover.md` — required staged migration from Prisma/NextAuth to Supabase Auth + RLS.
- `../supabase/README.md` — exact SQL Editor/auth-provisioning order for an existing project with real data.
- `TESTING.md` — release test matrix.
- `DEPLOYMENT.md` — historical deployment runbook; do not use its Prisma commands during the Supabase cutover.

## Supabase cutover status

This repository is in a **staged existing-data cutover**. Do not run Prisma commands or the legacy `.zscripts` deployment scripts. Start with the read-only preflight SQL in `supabase/sql/0000_preflight_existing_prisma_database.sql`, then follow `supabase/README.md`.

## Application route map

| Route | Audience | Purpose |
| --- | --- | --- |
| `/` | authenticated creators | Dashboard; app-state routes are represented by URL query state. |
| `/?view=builder&form=:id` | authenticated creator | Form builder. |
| `/?view=responses&form=:id` | authenticated creator | Response viewer. |
| `/?view=preview&form=:id` | authenticated creator | In-app draft/preview filler. |
| `/f/:slug` | public respondent | Published form filler. |
| `/api/*` | API clients | Application APIs. |

## Source layout

```text
src/
  app/            App Router pages and API routes
  components/     UI and feature components
  lib/            shared domain, security, auth, and data-access utilities
  store/          client app state
  types/          shared TypeScript contracts
supabase/sql/     reviewed SQL Editor scripts, ordered by filename
scripts/          one-time/server-only operational helpers
tests/            pure/domain tests
docs/             audit, migration, release, and planning records
```
