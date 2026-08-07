# Supabase SQL Editor / Auth cutover workflow

This project is moving from Prisma + custom NextAuth credential records to **Supabase Auth + Supabase RLS**. The current target is an **existing database with real data**; do not run any destructive or fresh-project SQL against it.

## Required order

1. **Create a recovery record first.** Prefer Supabase PITR/backups when available. On the free plan, use the private manual logical snapshot in step 4 before any write script; never commit or share it.
2. Run `sql/0000_preflight_existing_prisma_database.sql` in Supabase SQL Editor. Keep its output private; it can include schema and row counts.
3. Compare the preflight output with the expected legacy quoted tables. Resolve drift, duplicate orders, invalid statuses/types, and any unknown constraints before proceeding.

   **Project-specific path:** the current production preflight found only the seven older tables `"User"`, `"Workspace"`, `"Form"`, `"Question"`, `"FormEnding"`, `"Response"`, and `"Answer"`; it does not contain the legacy token, Google, or rate-limit tables assumed by the fuller migration. **Do not run `0001_prepare_existing_prisma_cutover.sql` or `0002_enable_rls_after_auth_cutover.sql` against that schema.**
4. On the free plan, create a no-cost private logical snapshot by running `sql/0000b_private_manual_snapshot_free_plan.sql` and saving its single result outside Git. It includes the legacy password hash, so do not share it, paste it into chat, or commit it. Provider-managed PITR is still preferable when available.
5. Run `sql/0001_prepare_existing_minimal_schema_cutover.sql`. It is transaction-wrapped and additive: it creates the auth UUID bridge and ledger, adds only reviewed compatibility columns/indexes/triggers/checks, and preserves every existing application row. It does **not** create auth users, send email, change existing table policies, or remove legacy password/token data.
6. Run `sql/0001a_verify_existing_minimal_schema_cutover.sql`. Stop and compare the output before provisioning an Auth account.
7. Configure Supabase Auth email delivery and add the exact recovery redirect URL to Supabase Auth's allowed redirect list.
8. In a trusted local/CI shell, set only server-side values:
   - `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_AUTH_REDIRECT_TO`

   Then run a dry run followed by the forced-reset provisioning step:

   ```bash
   node scripts/provision-supabase-auth-cutover.mjs
   node scripts/provision-supabase-auth-cutover.mjs --apply
   ```

   The script creates a random unusable temporary password per legacy account, links the Supabase Auth UUID, and sends a recovery email. It never prints secrets or passwords. Review `public.auth_cutover_ledger`; all rows must be `completed` before enabling the new Supabase Auth runtime.
9. Do **not** run the fuller-schema `0002_enable_rls_after_auth_cutover.sql`. The current seven tables already have RLS enabled and no browser policies. The application runtime will be migrated to a server-only service-role data layer after it independently verifies Supabase Auth; a tailored post-runtime RLS hardening script will be reviewed separately.
10. Only after the application code has been switched to Supabase Auth and a server-only service-role backend, retire the legacy NextAuth/PBKDF2 routes and eventually remove legacy password/token columns under a separate, reviewed retention migration.

## Important constraints

- **SQL Editor alone cannot safely create Supabase Auth users with forced password resets.** Supabase Auth user provisioning uses the Admin API; that is why step 8 is a server-only one-time script.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*`, browser code, logs, screenshots, or Git.
- Do not run `prisma db push`, `prisma migrate`, or the legacy `.zscripts` build/start paths during this cutover.
- These scripts are a controlled transition from the existing quoted Prisma schema. A clean/new-project baseline will be added separately after the live migration path is validated.
