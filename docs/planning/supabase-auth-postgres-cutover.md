# Supabase Auth + PostgreSQL cutover plan

**Chosen architecture:** Supabase Auth owns identity and sessions; Supabase RLS blocks direct browser table access; trusted Next route handlers verify a Supabase Auth user first and only then use a server-only service-role data client. Prisma and NextAuth are transition-only code slated for removal.

## Confirmed production inventory — 2026-08-07

The project-specific preflight found a small, internally consistent legacy database:

- `public."User"`: **1** row with a valid-looking PBKDF2 password hash.
- `public."Form"`: **1** row; `public."Question"`: **2** rows (`email`, `short_text`).
- `Workspace`, `FormEnding`, `Response`, and `Answer`: **0** rows.
- `auth.users` and `auth.identities`: **0** rows.
- No normalized-email collisions, orphaned relationships, invalid form limits, or duplicate ordering groups.
- The actual schema contains only `"User"`, `"Workspace"`, `"Form"`, `"Question"`, `"FormEnding"`, `"Response"`, and `"Answer"`. It does **not** contain the token, Google, or rate-limit tables from the newer Prisma schema.
- Core foreign keys exist. RLS is enabled on the seven tables but has no policies, no triggers, and is not forced. `service_role` has full table privileges; browser roles did not show grants.

The legacy user ID is CUID/text while Supabase Auth uses UUID. The PBKDF2 verifier cannot be transferred as a Supabase password hash, so the account must receive a forced recovery flow.

## Free-plan recovery record

Provider-managed PITR is ideal but unavailable on the current free plan. Before any write SQL, run:

```text
supabase/sql/0000b_private_manual_snapshot_free_plan.sql
```

Save its one result privately outside Git. It intentionally includes the legacy password hash, so it must never be pasted into chat, committed, uploaded, or screen-shared. This is a small logical recovery record for the current single-user dataset, not a substitute for managed PITR.

## Required cutover order

1. Keep the preflight output and create the private manual snapshot above.
2. Run **only** `supabase/sql/0001_prepare_existing_minimal_schema_cutover.sql` in SQL Editor. It is transaction-wrapped, additive, and guarded against the wrong table shape.
3. Run `supabase/sql/0001a_verify_existing_minimal_schema_cutover.sql`; compare only its redacted metadata/aggregate output.
4. Configure Supabase Auth email delivery, Site URL, and the exact `/auth/callback` recovery redirect allowlist.
5. In a trusted shell, set server-only `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_AUTH_REDIRECT_TO`. Run:

   ```bash
   node scripts/provision-supabase-auth-cutover.mjs
   node scripts/provision-supabase-auth-cutover.mjs --apply
   ```

   This creates exactly one Auth account, maps its UUID to the legacy CUID, and sends a recovery email. It does not print passwords, emails, IDs, reset links, or service keys.
6. Verify the ledger aggregate reports `completed = 1` and the legacy bridge has one mapped row.
7. Complete the code cutover: Supabase browser Auth, callback/recovery flow, verified server-side legacy-owner lookup, and Supabase service-role data access. Public tables remain inaccessible to browser clients.
8. Only after end-to-end staging verification, remove legacy NextAuth/Prisma runtime paths and eventually retire legacy password data under a separately reviewed retention migration.

## Current implementation state

The repository now contains the minimal-schema SQL path, a free-plan private snapshot query, a resumable forced-recovery helper, a Supabase Auth browser provider/recovery callback, and Supabase data access for core form/workspace routes. The full no-Prisma route rewrite is still in progress; do not deploy the partial source cutover before the remaining response, public-page, Google integration, and test paths have been migrated.

## Explicit non-goals in the preparation migration

- No `DROP`, `TRUNCATE`, destructive reset, or legacy-row deletion.
- No `prisma db push` / `prisma migrate`.
- No raw `anon`/`authenticated` browser access to `User`, forms, responses, hidden fields, scores, or ledger tables.
- No service-role key in browser code, `NEXT_PUBLIC_*`, output, screenshots, or Git.
- No use of the incompatible fuller-schema `0001_prepare_existing_prisma_cutover.sql` or `0002_enable_rls_after_auth_cutover.sql`.

## Dependency update policy

The project uses npm with a committed `package-lock.json`. Direct packages were updated to current major releases where the surrounding ecosystem supports them. TypeScript remains on the latest Next-compatible release (`^6.0.3`), rather than TypeScript 7, because the current Next ESLint stack rejects TypeScript 7. Prisma remains temporarily on 6.19.x only while unconverted source files remain; it will not be upgraded to Prisma 7 because the destination architecture has no Prisma.
