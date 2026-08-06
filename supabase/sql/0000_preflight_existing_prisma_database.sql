-- FOR EXISTING DATABASES ONLY — read-only preflight.
-- Run this first in the Supabase SQL Editor and save the results outside Git.
-- It contains catalog reads and aggregate SELECTs only: it does not change data
-- or schema. Do not run the cutover/RLS scripts until every expected table and
-- the existing user/data counts are understood.
--
-- Do not paste raw rows, emails, password hashes, auth identities, tokens,
-- project URLs, database URLs, or keys into chat. The queries below deliberately
-- return only metadata, values used as enum/status labels, and aggregate counts.
-- If section 1 reports a missing expected table, stop after section 5a and
-- share the earlier metadata/results; sections 6 onward reference legacy tables.

-- 0. Inventory every relation currently exposed in public, including tables the
-- legacy Prisma schema does not know about. Estimated rows are catalog estimates,
-- not an exact count.
SELECT
  c.relname AS relation_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    WHEN 'f' THEN 'foreign table'
    ELSE c.relkind::text
  END AS relation_type,
  c.reltuples::bigint AS estimated_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY relation_type, relation_name;

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

-- 5a. RLS is only one half of PostgREST exposure. Record explicit table grants
-- for browser-facing and service roles without changing any grants.
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 6. Existing Supabase Auth users. Do not export emails/identities from a shared
-- screen capture; compare only aggregate counts to the legacy User count.
SELECT
  (SELECT count(*) FROM auth.users) AS auth_user_count,
  CASE WHEN to_regclass('public."User"') IS NOT NULL
       THEN (SELECT count(*) FROM public."User")
       ELSE 0 END AS legacy_user_count;

-- 6a. Establish the safe account-linking path without returning a single email.
-- A matching email count does NOT authorize an automatic overwrite: it only
-- tells us whether existing auth.users accounts must be reconciled instead of
-- blindly created again.
WITH legacy AS (
  SELECT lower(btrim(email)) AS normalized_email
  FROM public."User"
  WHERE email IS NOT NULL AND btrim(email) <> ''
),
auth_accounts AS (
  SELECT lower(btrim(email)) AS normalized_email,
         email_confirmed_at IS NOT NULL AS email_confirmed
  FROM auth.users
  WHERE email IS NOT NULL AND btrim(email) <> ''
),
legacy_by_email AS (
  SELECT normalized_email, count(*) AS row_count
  FROM legacy
  GROUP BY normalized_email
),
auth_by_email AS (
  SELECT normalized_email, count(*) AS row_count
  FROM auth_accounts
  GROUP BY normalized_email
)
SELECT
  (SELECT count(*) FROM legacy) AS legacy_rows_with_nonblank_email,
  (SELECT count(*) FROM auth_accounts) AS auth_rows_with_nonblank_email,
  (SELECT count(*) FROM legacy l JOIN auth_by_email a USING (normalized_email))
    AS legacy_rows_matching_an_auth_email,
  (SELECT count(*) FROM legacy l LEFT JOIN auth_by_email a USING (normalized_email)
   WHERE a.normalized_email IS NULL) AS legacy_rows_without_auth_email,
  (SELECT count(*) FROM auth_accounts a JOIN legacy_by_email l USING (normalized_email))
    AS auth_rows_matching_a_legacy_email,
  (SELECT count(*) FROM auth_accounts a LEFT JOIN legacy_by_email l USING (normalized_email)
   WHERE l.normalized_email IS NULL) AS auth_rows_without_legacy_email,
  (SELECT count(*) FROM legacy_by_email WHERE row_count > 1)
    AS duplicate_normalized_legacy_email_groups,
  (SELECT count(*) FROM auth_by_email WHERE row_count > 1)
    AS duplicate_normalized_auth_email_groups,
  (SELECT count(*) FROM auth_accounts a JOIN legacy_by_email l USING (normalized_email)
   WHERE a.email_confirmed) AS matching_confirmed_auth_rows;

-- Provider totals reveal whether the project has pre-existing password/OAuth
-- identities without exposing identity data.
SELECT coalesce(provider, '(null)') AS provider, count(*) AS identity_count
FROM auth.identities
GROUP BY provider
ORDER BY provider;

-- 6b. Verify legacy login records are structurally usable for a forced-reset
-- bridge. This never returns an email or password/hash value.
WITH legacy AS (
  SELECT lower(btrim(email)) AS normalized_email, "password" AS password
  FROM public."User"
),
duplicate_emails AS (
  SELECT normalized_email
  FROM legacy
  WHERE normalized_email IS NOT NULL AND normalized_email <> ''
  GROUP BY normalized_email
  HAVING count(*) > 1
)
SELECT
  count(*) AS legacy_user_rows,
  count(*) FILTER (WHERE normalized_email IS NULL OR normalized_email = '')
    AS blank_legacy_email_rows,
  count(*) FILTER (WHERE password IS NULL OR btrim(password) = '')
    AS blank_legacy_password_rows,
  count(*) FILTER (
    WHERE password ~ '^pbkdf2:[0-9]+:[0-9A-Fa-f]+:[0-9A-Fa-f]+$'
  ) AS pbkdf2_shaped_password_rows,
  (SELECT count(*) FROM duplicate_emails) AS duplicate_normalized_legacy_email_groups
FROM legacy;

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


-- 9. Exact record counts. Run only after section 1 confirms every expected
-- table exists. Unlike the catalog estimates above, these are exact counts and
-- still disclose no row contents.
SELECT *
FROM (
  SELECT 'Answer' AS table_name, count(*)::bigint AS exact_rows FROM public."Answer"
  UNION ALL SELECT 'EmailVerificationToken', count(*)::bigint FROM public."EmailVerificationToken"
  UNION ALL SELECT 'Form', count(*)::bigint FROM public."Form"
  UNION ALL SELECT 'FormEnding', count(*)::bigint FROM public."FormEnding"
  UNION ALL SELECT 'GoogleConnection', count(*)::bigint FROM public."GoogleConnection"
  UNION ALL SELECT 'GoogleSheetDestination', count(*)::bigint FROM public."GoogleSheetDestination"
  UNION ALL SELECT 'GoogleSheetSyncEvent', count(*)::bigint FROM public."GoogleSheetSyncEvent"
  UNION ALL SELECT 'PasswordResetToken', count(*)::bigint FROM public."PasswordResetToken"
  UNION ALL SELECT 'PublicRateLimit', count(*)::bigint FROM public."PublicRateLimit"
  UNION ALL SELECT 'Question', count(*)::bigint FROM public."Question"
  UNION ALL SELECT 'Response', count(*)::bigint FROM public."Response"
  UNION ALL SELECT 'User', count(*)::bigint FROM public."User"
  UNION ALL SELECT 'Workspace', count(*)::bigint FROM public."Workspace"
) AS counts
ORDER BY table_name;

-- 10. Referential/ownership integrity checks. Every output should be zero.
-- These aggregate checks identify drift before any auth bridge, RLS policy, or
-- new SQL constraint is designed.
SELECT
  (SELECT count(*)
   FROM public."Workspace" w
   LEFT JOIN public."User" u ON u.id = w."userId"
   WHERE u.id IS NULL) AS workspaces_without_owner,
  (SELECT count(*)
   FROM public."Form" f
   LEFT JOIN public."User" u ON u.id = f."userId"
   WHERE u.id IS NULL) AS forms_without_owner,
  (SELECT count(*)
   FROM public."Form" f
   LEFT JOIN public."Workspace" w ON w.id = f."workspaceId"
   WHERE f."workspaceId" IS NOT NULL AND w.id IS NULL) AS forms_with_missing_workspace,
  (SELECT count(*)
   FROM public."Form" f
   JOIN public."Workspace" w ON w.id = f."workspaceId"
   WHERE f."userId" IS DISTINCT FROM w."userId") AS form_workspace_owner_mismatches,
  (SELECT count(*)
   FROM public."Question" q
   LEFT JOIN public."Form" f ON f.id = q."formId"
   WHERE f.id IS NULL) AS questions_without_form,
  (SELECT count(*)
   FROM public."FormEnding" e
   LEFT JOIN public."Form" f ON f.id = e."formId"
   WHERE f.id IS NULL) AS endings_without_form,
  (SELECT count(*)
   FROM public."Response" r
   LEFT JOIN public."Form" f ON f.id = r."formId"
   WHERE f.id IS NULL) AS responses_without_form,
  (SELECT count(*)
   FROM public."Answer" a
   LEFT JOIN public."Response" r ON r.id = a."responseId"
   WHERE r.id IS NULL) AS answers_without_response,
  (SELECT count(*)
   FROM public."Answer" a
   LEFT JOIN public."Question" q ON q.id = a."questionId"
   WHERE q.id IS NULL) AS answers_without_question,
  (SELECT count(*)
   FROM public."Answer" a
   JOIN public."Response" r ON r.id = a."responseId"
   JOIN public."Question" q ON q.id = a."questionId"
   WHERE r."formId" IS DISTINCT FROM q."formId") AS answers_crossing_forms,
  (SELECT count(*)
   FROM public."PasswordResetToken" t
   LEFT JOIN public."User" u ON u.id = t."userId"
   WHERE u.id IS NULL) AS reset_tokens_without_user,
  (SELECT count(*)
   FROM public."EmailVerificationToken" t
   LEFT JOIN public."User" u ON u.id = t."userId"
   WHERE u.id IS NULL) AS verification_tokens_without_user,
  (SELECT count(*)
   FROM public."GoogleConnection" c
   LEFT JOIN public."User" u ON u.id = c."userId"
   WHERE u.id IS NULL) AS google_connections_without_user,
  (SELECT count(*)
   FROM public."GoogleSheetDestination" d
   LEFT JOIN public."Form" f ON f.id = d."formId"
   WHERE f.id IS NULL) AS google_destinations_without_form,
  (SELECT count(*)
   FROM public."GoogleSheetDestination" d
   LEFT JOIN public."GoogleConnection" c ON c.id = d."connectionId"
   WHERE c.id IS NULL) AS google_destinations_without_connection,
  (SELECT count(*)
   FROM public."GoogleSheetDestination" d
   JOIN public."Form" f ON f.id = d."formId"
   JOIN public."GoogleConnection" c ON c.id = d."connectionId"
   WHERE f."userId" IS DISTINCT FROM c."userId") AS google_destination_owner_mismatches,
  (SELECT count(*)
   FROM public."GoogleSheetSyncEvent" e
   LEFT JOIN public."GoogleSheetDestination" d ON d.id = e."destinationId"
   WHERE d.id IS NULL) AS google_events_without_destination,
  (SELECT count(*)
   FROM public."GoogleSheetSyncEvent" e
   LEFT JOIN public."Response" r ON r.id = e."responseId"
   WHERE r.id IS NULL) AS google_events_without_response,
  (SELECT count(*)
   FROM public."GoogleSheetSyncEvent" e
   JOIN public."GoogleSheetDestination" d ON d.id = e."destinationId"
   JOIN public."Response" r ON r.id = e."responseId"
   WHERE d."formId" IS DISTINCT FROM r."formId") AS google_events_crossing_forms;

-- 11. Duplicate display-order groups are not necessarily corrupt today, but
-- they must be understood before enforcing deterministic ordering constraints.
SELECT *
FROM (
  SELECT 'Workspace.userId/order' AS scope,
         count(*)::bigint AS duplicate_groups,
         coalesce(sum(row_count), 0)::bigint AS rows_in_duplicate_groups
  FROM (
    SELECT "userId", "order", count(*) AS row_count
    FROM public."Workspace"
    GROUP BY "userId", "order"
    HAVING count(*) > 1
  ) AS duplicate_workspaces
  UNION ALL
  SELECT 'Question.formId/order', count(*)::bigint, coalesce(sum(row_count), 0)::bigint
  FROM (
    SELECT "formId", "order", count(*) AS row_count
    FROM public."Question"
    GROUP BY "formId", "order"
    HAVING count(*) > 1
  ) AS duplicate_questions
  UNION ALL
  SELECT 'FormEnding.formId/order', count(*)::bigint, coalesce(sum(row_count), 0)::bigint
  FROM (
    SELECT "formId", "order", count(*) AS row_count
    FROM public."FormEnding"
    GROUP BY "formId", "order"
    HAVING count(*) > 1
  ) AS duplicate_endings
) AS duplicate_order_summary
ORDER BY scope;
