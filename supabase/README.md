# Supabase SQL Editor / Auth cutover workflow

This project is moving from Prisma + custom NextAuth credential records to **Supabase Auth + Supabase RLS**. The current target is an **existing database with real data**; do not run any destructive or fresh-project SQL against it.

## Required order

1. **Back up first.** In Supabase, confirm PITR/backups and take an export/snapshot. Do not continue without a tested recovery plan.
2. Run `sql/0000_preflight_existing_prisma_database.sql` in Supabase SQL Editor. Keep its output private; it can include schema and row counts.
3. Compare the preflight output with the expected legacy quoted tables. Resolve drift, duplicate orders, invalid statuses/types, and any unknown constraints before proceeding.
4. Run `sql/0001_prepare_existing_prisma_cutover.sql`. It is additive: it creates the auth bridge ledger, auth UUID column, missing indexes, timestamp triggers, and **NOT VALID** checks. It does **not** create auth users, enable RLS, or remove old password data.
5. Configure Supabase Auth email delivery and add the exact recovery redirect URL to Supabase Auth's allowed redirect list.
6. In a trusted local/CI shell, set only server-side values:
   - `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_AUTH_REDIRECT_TO`

   Then run a dry run followed by the forced-reset provisioning step:

   ```bash
   node scripts/provision-supabase-auth-cutover.mjs
   node scripts/provision-supabase-auth-cutover.mjs --apply
   ```

   The script creates a random unusable temporary password per legacy account, links the Supabase Auth UUID, and sends a recovery email. It never prints secrets or passwords. Review `public.auth_cutover_ledger`; all rows must be `completed` before RLS.
7. Run `sql/0002_enable_rls_after_auth_cutover.sql`. It refuses to run when any legacy account is unmapped/incomplete. It enables and forces RLS on application tables and intentionally denies direct browser access to raw response/token/hidden/scoring data.
8. Only after the application code has been switched to Supabase Auth and a server-only service-role backend, retire the legacy NextAuth/PBKDF2 routes and eventually remove legacy password/token columns under a separate, reviewed retention migration.

## Important constraints

- **SQL Editor alone cannot safely create Supabase Auth users with forced password resets.** Supabase Auth user provisioning uses the Admin API; that is why step 6 is a server-only one-time script.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*`, browser code, logs, screenshots, or Git.
- Do not run `prisma db push`, `prisma migrate`, or the legacy `.zscripts` build/start paths during this cutover.
- These scripts are a controlled transition from the existing quoted Prisma schema. A clean/new-project baseline will be added separately after the live migration path is validated.
