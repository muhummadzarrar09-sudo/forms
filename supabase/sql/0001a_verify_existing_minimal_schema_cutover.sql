-- READ-ONLY VERIFICATION FOR 0001_prepare_existing_minimal_schema_cutover.sql.
-- Run immediately after 0001. It returns no user emails, hashes, tokens, or
-- form/response contents. Do not begin Auth provisioning if a result conflicts
-- with the expected values described in the comments.

-- 1. The migration ledger should contain this one applied version.
SELECT version, applied_at, notes
FROM public.app_schema_migrations
WHERE version = '0001_prepare_existing_minimal_schema_cutover';

-- 2. The legacy bridge exists but remains unmapped until the server-only Auth
-- provisioning helper is deliberately run. Expected now: total_legacy_users=1,
-- mapped_legacy_users=0, pending_cutover_rows=1.
SELECT
  count(*) AS total_legacy_users,
  count(*) FILTER (WHERE "authUserId" IS NOT NULL) AS mapped_legacy_users
FROM public."User";

SELECT status, count(*) AS row_count
FROM public.auth_cutover_ledger
GROUP BY status
ORDER BY status;

-- 3. Confirm the expected compatibility columns exist. No values are returned.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'User' AND column_name = 'authUserId')
    OR (table_name = 'Form' AND column_name = 'calculatedVariables')
    OR (table_name = 'Response' AND column_name IN (
      'status', 'internalNote', 'editTokenHash', 'editTokenExpiresAt'
    ))
  )
ORDER BY table_name, column_name;

-- 4. The bridge, data checks, and answer uniqueness index should now exist.
SELECT
  c.conrelid::regclass AS table_name,
  c.conname,
  c.contype,
  c.convalidated,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND c.conname IN (
    'User_authUserId_fkey',
    'Question_type_check',
    'Response_status_check',
    'Form_maxResponses_check'
  )
ORDER BY 1, 2;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'User_authUserId_key',
    'Form_userId_updatedAt_idx',
    'Form_workspaceId_idx',
    'Workspace_userId_order_idx',
    'Question_formId_order_idx',
    'FormEnding_formId_order_idx',
    'Response_formId_startedAt_idx',
    'Response_formId_isPartial_idx',
    'Response_formId_status_idx',
    'Answer_questionId_idx',
    'Answer_responseId_questionId_key',
    'Response_editTokenHash_key',
    'auth_cutover_ledger_normalized_email_key'
  )
ORDER BY tablename, indexname;

-- 5. Database-owned timestamp triggers must be installed for the five tables
-- that have legacy updatedAt columns.
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND trigger_name IN ('touch_updated_at', 'touch_auth_cutover_ledger_updated_at')
ORDER BY table_name, trigger_name, event_manipulation;

-- 6. New administrative tables are RLS-enabled and have no browser grants.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('app_schema_migrations', 'auth_cutover_ledger')
ORDER BY c.relname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('app_schema_migrations', 'auth_cutover_ledger')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;
