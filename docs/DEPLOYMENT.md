# Fresh Supabase + Vercel Deployment Runbook

This runbook assumes a **new, empty Supabase PostgreSQL project**. It is not a migration procedure for an existing client database.

## 1. Create secrets outside Git

Create a local ignored `.env` from `.env.example`, or set these directly in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL` (the canonical production HTTPS URL)
- `NEXTAUTH_SECRET` (`openssl rand -hex 32`)
- optionally `NEXT_PUBLIC_APP_URL`

Never commit any of them. `.env` is intentionally removed from tracking; only `.env.example` belongs in Git.

## 2. Initialize the empty database once

From a trusted local shell with the **new project’s** URLs set:

```bash
bun install --frozen-lockfile
bunx prisma db push
```

This project has no historical baseline migration for the original application schema, so `prisma migrate deploy` alone cannot initialize a new database. `db push` is acceptable only for this brand-new empty personal database. Capture the resulting schema baseline/migrations before a future production/client handoff.

Confirm:

```bash
bunx prisma validate
```

## 3. Configure Vercel

Add the same values to the Vercel Production environment. Do not put database credentials in `NEXT_PUBLIC_*` variables.

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
