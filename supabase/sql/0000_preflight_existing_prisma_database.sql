-- FOR EXISTING DATABASES ONLY — read-only preflight.
-- Run this first in the Supabase SQL Editor and save the results outside Git.
-- It does not change data or schema. Do not run the cutover/RLS scripts until
-- every expected table and the existing user/data counts are understood.

-- 1. Expected legacy Prisma tables, whether they exist, and approximate data counts.
WITH expected(table_name) AS (
  VALUES
    ('User'), ('Form'), ('Workspace'), ('Question'), ('Response'), ('Answer'),
    ('FormEnding'), ('PasswordResetToken'), ('EmailVerificationToken'),
    ('GoogleConnection'), ('GoogleSheetDestination'), ('GoogleSheetSyncEvent'),
    ('PublicRateLimit')
)
SELECT
  expected.table_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = expected.table_name
  ) AS table_exists,
  COALESCE((
    SELECT c.reltuples::bigint
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = expected.table_name
  ), 0) AS estimated_rows
FROM expected
ORDER BY expected.table_name;

-- 2. Current columns and nullability. Confirm `User.id`, email, password and
-- every FK before running the auth bridge migration.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'User', 'Form', 'Workspace', 'Question', 'Response', 'Answer', 'FormEnding',
    'PasswordResetToken', 'EmailVerificationToken', 'GoogleConnection',
    'GoogleSheetDestination', 'GoogleSheetSyncEvent', 'PublicRateLimit'
  )
ORDER BY table_name, ordinal_position;

-- 3. Existing primary/foreign/unique/check constraints.
SELECT
  c.conrelid::regclass AS table_name,
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
ORDER BY table_name::text, c.conname;

-- 4. Existing indexes, including any index that exists in production but is
-- absent from Prisma schema/migrations.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. RLS/policy state. A clean result is NOT a pass: it means policies are
-- absent and the later RLS script must be applied after auth-user mapping.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Existing Supabase Auth users. Do not export emails/identities from a shared
-- screen capture; compare only aggregate counts to the legacy User count.
SELECT
  (SELECT count(*) FROM auth.users) AS auth_user_count,
  CASE WHEN to_regclass('public."User"') IS NOT NULL
       THEN (SELECT count(*) FROM public."User")
       ELSE 0 END AS legacy_user_count;

-- 7. Detect migration history. Existing Prisma migrations are only partial;
-- record this result before creating a new SQL-editor migration ledger.
SELECT to_regclass('public._prisma_migrations') AS prisma_migration_table,
       to_regclass('public.app_schema_migrations') AS sql_editor_migration_table;

-- 8. Detect values that will block later CHECK constraints. Review/fix these
-- before validating the corresponding NOT VALID constraints.
SELECT 'Question.type' AS field, type AS value, count(*)
FROM public."Question"
GROUP BY type
ORDER BY count(*) DESC;

SELECT 'Response.status' AS field, status AS value, count(*)
FROM public."Response"
GROUP BY status
ORDER BY count(*) DESC;

SELECT 'GoogleSheetSyncEvent.status' AS field, status AS value, count(*)
FROM public."GoogleSheetSyncEvent"
GROUP BY status
ORDER BY count(*) DESC;
