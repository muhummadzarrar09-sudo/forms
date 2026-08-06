# Supabase Auth + PostgreSQL cutover plan

**Chosen architecture:** Supabase Auth for identity/session lifecycle, Supabase RLS for database policy, server-only Supabase service-role client for the existing Next API after it verifies the Supabase Auth caller. Existing legacy PBKDF2 accounts will receive a **mandatory Supabase password-reset email**.

## Why this is staged

The live database contains real data. Prisma's legacy `User.id` values are CUID strings, while Supabase Auth users have UUIDs; PBKDF2 password hashes cannot safely be imported as Supabase Auth password hashes. Removing Prisma/NextAuth before mapping every account would lock users out and orphan ownership references.

The implementation therefore has these gates:

1. Run `supabase/sql/0000_preflight_existing_prisma_database.sql` in SQL Editor.
2. Back up the project and validate the preflight output.
3. Run `0001_prepare_existing_prisma_cutover.sql`.
4. Run the server-only forced-reset provisioning script in dry-run then apply mode.
5. Confirm every `auth_cutover_ledger` row is `completed`.
6. Run `0002_enable_rls_after_auth_cutover.sql`.
7. Deploy the Supabase Auth/API code cutover and verify auth, owner isolation, public submissions, exports, and Google outbox in staging.
8. Retire legacy NextAuth/PBKDF2 tables/routes only after a defined recovery grace period and backup validation.

## Dependency update policy

The project is being moved to npm with committed `package-lock.json` for reproducible dependency resolution. Direct packages were updated to current major releases where their ecosystem supports them. Two latest-major choices are deliberately held to the latest compatible version during the transition:

- TypeScript is pinned to `^6.0.3`, not 7.x, because the current `eslint-config-next`/`typescript-eslint` stack rejects TypeScript 7.
- Prisma remains temporarily on 6.19.x only to keep the legacy application buildable until the SQL/Auth data cutover is executed. It is scheduled for removal with the actual route/repository rewrite; it will not be upgraded to Prisma 7 because the selected target is no Prisma.

`npm audit --omit=dev` is clean after the dependency refresh. The legacy NextAuth optional Nodemailer peer range is temporarily overridden by patched Nodemailer 9 because the app’s custom SMTP path needs the security fix and Supabase Auth will replace it during cutover.
