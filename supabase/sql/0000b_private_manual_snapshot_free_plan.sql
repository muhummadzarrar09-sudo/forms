-- PRIVATE, MANUAL LOGICAL SNAPSHOT FOR THE CURRENT FREE-PLAN PROJECT.
--
-- This query is read-only. It returns the rows from the seven discovered
-- application tables as one JSON document so you can save it PRIVATELY before
-- applying a schema migration. It includes the legacy PBKDF2 password hash,
-- so treat the result like a credential backup:
--   - run it only in your own Supabase SQL Editor;
--   - save the result in an encrypted/private local file;
--   - NEVER paste, commit, upload, screenshot, or send the result here.
--
-- It is not a replacement for provider-managed PITR, but it is a useful
-- no-cost recovery record for this very small project (1 user / 1 form / 2
-- questions at preflight time). The schema/constraint inventories are recorded
-- separately by 0000 and 0000a.

SELECT jsonb_pretty(
  jsonb_build_object(
    'snapshot_format', 'forms-private-logical-snapshot-v1',
    'captured_at_utc', timezone('utc', now()),
    'User', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.id)
      FROM public."User" AS row_data
    ), '[]'::jsonb),
    'Workspace', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.id)
      FROM public."Workspace" AS row_data
    ), '[]'::jsonb),
    'Form', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.id)
      FROM public."Form" AS row_data
    ), '[]'::jsonb),
    'Question', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data."formId", row_data."order", row_data.id)
      FROM public."Question" AS row_data
    ), '[]'::jsonb),
    'FormEnding', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data."formId", row_data."order", row_data.id)
      FROM public."FormEnding" AS row_data
    ), '[]'::jsonb),
    'Response', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.id)
      FROM public."Response" AS row_data
    ), '[]'::jsonb),
    'Answer', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.id)
      FROM public."Answer" AS row_data
    ), '[]'::jsonb)
  )
) AS private_snapshot;
