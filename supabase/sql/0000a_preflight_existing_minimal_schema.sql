-- FOLLOW-UP PREFLIGHT FOR THE DISCOVERED MINIMAL LEGACY SCHEMA.
--
-- Use this only after 0000 confirms that the existing production schema has
-- these seven tables:
--   "User", "Workspace", "Form", "Question", "FormEnding", "Response", "Answer"
--
-- This is SELECT-only. It neither changes data/schema nor reads raw user,
-- response, password, token, or identity values. Do NOT run 0001 or 0002 yet.

-- 1. Corrected constraint inventory. This fixes the ORDER BY alias issue in
-- the original preflight query and reveals primary/foreign/unique/check rules.
SELECT
  c.conrelid::regclass AS table_name,
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
ORDER BY 1, 2;

-- 2. Table ownership and RLS state. A table owner and the service_role can
-- bypass RLS, so RLS enabled=true alone is not proof of browser protection.
SELECT
  c.relname AS table_name,
  pg_get_userbyid(c.relowner) AS table_owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

-- 3. Existing RLS policies. An empty result means RLS denies normal anon /
-- authenticated requests unless another privileged backend is being used.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Database triggers. This tells us whether updatedAt values are maintained
-- in the database or only by legacy Prisma writes.
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_orientation,
  action_condition,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation;

-- 5. Auth versus legacy-user aggregates. No emails or identity payloads are
-- returned. Email matches identify reconciliation work; they do NOT authorize
-- blindly linking or overwriting accounts.
SELECT
  (SELECT count(*) FROM public."User") AS legacy_user_count,
  (SELECT count(*) FROM auth.users) AS supabase_auth_user_count;

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

SELECT coalesce(provider, '(null)') AS provider, count(*) AS identity_count
FROM auth.identities
GROUP BY provider
ORDER BY provider;

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

-- 6. Migration-table discovery and exact, content-free record totals.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%migration%'
ORDER BY table_name;

SELECT *
FROM (
  SELECT 'Answer' AS table_name, count(*)::bigint AS exact_rows FROM public."Answer"
  UNION ALL SELECT 'Form', count(*)::bigint FROM public."Form"
  UNION ALL SELECT 'FormEnding', count(*)::bigint FROM public."FormEnding"
  UNION ALL SELECT 'Question', count(*)::bigint FROM public."Question"
  UNION ALL SELECT 'Response', count(*)::bigint FROM public."Response"
  UNION ALL SELECT 'User', count(*)::bigint FROM public."User"
  UNION ALL SELECT 'Workspace', count(*)::bigint FROM public."Workspace"
) AS counts
ORDER BY table_name;

-- 7. Referential and ownership consistency. Each result should be zero.
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
   FROM public."Response"
   WHERE "editToken" IS NOT NULL AND btrim("editToken") <> '')
    AS responses_with_plaintext_edit_token;

-- 8. Data-shape checks that avoid raw form/response values.
SELECT 'Question.type' AS field, type AS value, count(*)
FROM public."Question"
GROUP BY type
ORDER BY count(*) DESC, type;

SELECT
  count(*) FILTER (WHERE "maxResponses" < 0) AS forms_with_negative_max_responses,
  count(*) FILTER (WHERE "closeDate" IS NOT NULL AND "closeDate" < "createdAt")
    AS forms_closed_before_creation,
  count(*) FILTER (WHERE slug IS NOT NULL AND btrim(slug) = '') AS forms_with_blank_slug
FROM public."Form";

-- 9. Duplicate display-order groups. These are not necessarily corrupt now,
-- but must be understood before adding deterministic-order constraints.
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
