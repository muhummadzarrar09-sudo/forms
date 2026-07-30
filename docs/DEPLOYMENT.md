# Fresh Supabase + Vercel Deployment Runbook

This runbook assumes a **new, empty Supabase PostgreSQL project**. It is not a migration procedure for an existing client database.

## 0. Supabase connection string — MUST fix before deploy (avoids logs)

Supabase shows confusing Postgres logs if the pooler is mis-configured. This project has been patched to tolerate the pooler, but you must set URLs correctly:

- **`DATABASE_URL` = POOLED, port 6543, with `?pgbouncer=true&connection_limit=1`**

  ```
  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20
  ```

  In Supabase dashboard: **Project Settings → Database → Connection String → Connection Pooling → Nodejs**
  Take the port 6543 URL and append `?pgbouncer=true&connection_limit=1`.

  Without `pgbouncer=true` you will see in Supabase logs:
  - `ERROR: prepared statement "s0" already exists`
  - `ERROR: prepared statement "s0" does not exist`
  - Prisma `P1001: Can't reach database server`
  These happen because PgBouncer transaction mode doesn't support prepared statements.
  Prisma auto-disables them when `pgbouncer=true` is present.

  Without `connection_limit=1` (or with a non-singleton PrismaClient) you will see:
  - `FATAL: MaxClientsInSessionMode: max clients reached`
  - `remaining connection slots are reserved for non-replication superuser`
  `src/lib/db.ts` now caches the client globally in all envs to avoid this.

- **`DIRECT_URL` = DIRECT, port 5432 (or 6543 without pgbouncer)**

  ```
  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
  # or db.<ref>.supabase.co:5432
  ```

  Used only for `prisma migrate deploy` / `prisma db push`. Never use pooled URL here.

**Fixes applied in code:**
- `db.ts` singleton cached globally even in production + warning if pgbouncer missing
- All `pg_advisory_xact_lock` now via `$executeRaw` not `$queryRaw`
- `summary` + `health` raw SQL now via `$queryRawUnsafe(..., $1)` positional binds
- All `db.$transaction([ ... ])` batch arrays converted to interactive `db.$transaction(async (tx)=>{ ... })` for pooler compatibility
- `.env.example` documents correct format

If you still see errors, confirm in Vercel env:
- DATABASE_URL contains port 6543 + `pgbouncer=true`
- DIRECT_URL contains port 5432
- No `NEXT_PUBLIC_*` DB vars

## 1. Create secrets outside Git

Create a local ignored `.env` from `.env.example`, or set these directly in Vercel:

- `DATABASE_URL` (pooled + pgbouncer=true + connection_limit=1)
- `DIRECT_URL` (direct, port 5432)
- `NEXTAUTH_URL` (the canonical production HTTPS URL)
- `NEXTAUTH_SECRET` (`openssl rand -hex 32`)
- optionally `NEXT_PUBLIC_APP_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` (required for password reset and new-account email verification)
- `CRON_SECRET` (a random secret for the authenticated daily cleanup job)
- Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `INTEGRATION_ENCRYPTION_KEY` (base64 32-byte key; only required when enabling Google Sheets OAuth). Forms, exports, and analytics work normally without them.
- `TRUST_PROXY_HEADERS=true` **only** when deployed behind Caddy/the trusted edge configuration that overwrites `X-Real-IP`; otherwise leave it unset and public rate limits intentionally use a shared anonymous bucket.

Never commit any of them. `.env` is intentionally removed from tracking; only `.env.example` belongs in Git.

## 2. Initialize the empty database once

From a trusted local shell with the **new project’s** URLs set:

```bash
bun install --frozen-lockfile
bunx prisma db push
```

This project has no historical baseline migration for the original application schema, so `prisma migrate deploy` alone cannot initialize a new database. `db push` is acceptable only for this brand-new empty personal database. Capture the resulting schema baseline/migrations before a future production/client handoff.

For an **existing database** that already tracks the repository's prior Prisma migrations, deploy the two new hardening migrations before application rollout:

```bash
bunx prisma migrate deploy
```

They add durable public-rate-limit counters, enforce one answer per response/question (after deterministic duplicate cleanup), and replace plaintext incomplete-response resume tokens with expiring SHA-256 verifiers. Existing incomplete drafts become non-resumable by design during the credential migration.

Confirm:

```bash
bunx prisma validate
```

## 3. Configure Vercel

Add the same values to the Vercel Production environment.

Configure a daily scheduler to `POST /api/internal/cleanup` and a frequent scheduler (for example every minute) to `POST /api/internal/google-sheets-sync`, both with
`Authorization: Bearer $CRON_SECRET`. Cleanup removes expired password-reset and
email-verification credentials, unusable abandoned drafts, and stale rate-limit
buckets; the Sheets worker delivers queued response rows with retries. Do not expose either endpoint without its bearer secret. Do not put database credentials in `NEXT_PUBLIC_*` variables.

The repository now has a `postinstall` script that runs `prisma generate`, so the generated client is available during Vercel’s install/build step.

## 4. Commit and deploy

Before pushing, review:

```bash
git status
git diff --check
bun run test:unit
bunx tsc --noEmit
bun run lint
bun run build
```

Then commit/push. Vercel can auto-deploy the resulting branch.

## 5. Production-safe personal smoke test

After deployment, provide the deployed URL/commit. Because this is a personal empty build, the smoke suite may create explicit `E2E`-prefixed test users/forms/responses and clean them up. It can then run the public 14-type, logic, ownership, response-cap, mobile, keyboard, navigation, and export checks.

## Security history note

Even if the old Supabase project is paused, do not reuse its credentials or old `NEXTAUTH_SECRET`. Keep the new credentials out of Git. The old committed secret still needs Git-history cleanup before sharing the repository broadly.
