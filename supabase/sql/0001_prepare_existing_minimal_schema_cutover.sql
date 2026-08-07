-- EXISTING MINIMAL-SCHEMA PREPARATION — additive, idempotent, and non-destructive.
--
-- Target confirmed by 0000 / 0000a preflight:
--   "User", "Workspace", "Form", "Question", "FormEnding", "Response", "Answer"
--
-- Before running this in Supabase SQL Editor:
--   1. Run 0000b_private_manual_snapshot_free_plan.sql and save its ONE result
--      privately. It contains a password hash; never paste or commit it.
--   2. Confirm that the project still has exactly the preflighted shape, or
--      rerun 0000a if you have written new data since the preflight.
--
-- This script does NOT drop/truncate/delete legacy data, create auth.users,
-- send email, enable browser access, or alter existing RLS policies. It adds a
-- Supabase Auth bridge, an auditable cutover ledger, compatibility columns used
-- by the current application, database-owned update timestamps, safe indexes,
-- and validated checks based on the observed data.
--
-- DO NOT use 0001_prepare_existing_prisma_cutover.sql for this project. That
-- fuller-schema script expects absent token, Google, and rate-limit tables.

BEGIN;

-- Fail before making any change if this is not the seven-table legacy shape
-- reviewed in the preflight. This prevents applying a project-specific script
-- to an unknown/fresh/drifted database.
DO $$
DECLARE
  missing_table text;
  required_tables text[] := ARRAY[
    'public."User"',
    'public."Workspace"',
    'public."Form"',
    'public."Question"',
    'public."FormEnding"',
    'public."Response"',
    'public."Answer"'
  ];
BEGIN
  FOREACH missing_table IN ARRAY required_tables LOOP
    IF to_regclass(missing_table) IS NULL THEN
      RAISE EXCEPTION 'Refusing minimal-schema preparation: required table % is missing. Rerun preflight.', missing_table;
    END IF;
  END LOOP;

  IF to_regclass('public."PasswordResetToken"') IS NOT NULL
     OR to_regclass('public."EmailVerificationToken"') IS NOT NULL
     OR to_regclass('public."GoogleConnection"') IS NOT NULL
     OR to_regclass('public."GoogleSheetDestination"') IS NOT NULL
     OR to_regclass('public."GoogleSheetSyncEvent"') IS NOT NULL
     OR to_regclass('public."PublicRateLimit"') IS NOT NULL THEN
    RAISE EXCEPTION 'Refusing minimal-schema preparation: fuller-schema tables now exist. Rerun preflight and use the reviewed migration path.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'email'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'password'
  ) THEN
    RAISE EXCEPTION 'Refusing minimal-schema preparation: legacy User email/password columns do not match the reviewed shape.';
  END IF;

  -- The one-time account bridge relies on a unique, usable normalized email.
  IF EXISTS (
    SELECT 1
    FROM public."User"
    WHERE email IS NULL OR btrim(email) = ''
  ) THEN
    RAISE EXCEPTION 'Refusing minimal-schema preparation: one or more legacy users have a blank email.';
  END IF;

  IF EXISTS (
    SELECT lower(btrim(email))
    FROM public."User"
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Refusing minimal-schema preparation: normalized legacy email duplicates exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Answer"
    GROUP BY "responseId", "questionId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Refusing minimal-schema preparation: duplicate Answer responseId/questionId pairs exist.';
  END IF;
END $$;

-- A small SQL-editor migration ledger replaces untracked prisma db push state.
CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by uuid REFERENCES auth.users(id),
  notes text NOT NULL DEFAULT ''
);

-- Keep legacy CUID ownership IDs intact. Supabase Auth identities use UUIDs,
-- so this nullable one-to-one bridge is the safe link between the two systems.
ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "authUserId" uuid;

CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key"
  ON public."User" ("authUserId")
  WHERE "authUserId" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public."User"'::regclass
      AND conname = 'User_authUserId_fkey'
  ) THEN
    ALTER TABLE public."User"
      ADD CONSTRAINT "User_authUserId_fkey"
      FOREIGN KEY ("authUserId") REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- The ledger has no password, reset token, or access token. It is the only
-- durable record of the one-time legacy-user -> auth.users handoff.
CREATE TABLE IF NOT EXISTS public.auth_cutover_ledger (
  legacy_user_id text PRIMARY KEY REFERENCES public."User"(id) ON DELETE CASCADE,
  email text NOT NULL,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  provisioned_at timestamptz,
  reset_sent_at timestamptz,
  completed_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_cutover_ledger_status_check
    CHECK (status IN ('pending', 'provisioned', 'reset_sent', 'completed', 'failed')),
  CONSTRAINT auth_cutover_ledger_completed_check
    CHECK (
      status <> 'completed'
      OR (auth_user_id IS NOT NULL AND completed_at IS NOT NULL AND reset_sent_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_cutover_ledger_normalized_email_key
  ON public.auth_cutover_ledger (lower(email));

-- Seed or refresh only incomplete ledger rows. Completed mappings are not
-- overwritten by rerunning this preparation script.
INSERT INTO public.auth_cutover_ledger (legacy_user_id, email)
SELECT id, lower(btrim(email))
FROM public."User"
ON CONFLICT (legacy_user_id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = now()
WHERE public.auth_cutover_ledger.status IN ('pending', 'failed');

-- The currently checked-out application expects these columns. Adding them is
-- forward-compatible and does not remove the legacy plaintext editToken column;
-- that column is retired only later, after code no longer reads it.
ALTER TABLE public."Form"
  ADD COLUMN IF NOT EXISTS "calculatedVariables" text NOT NULL DEFAULT '[]'::text;

ALTER TABLE public."Response"
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS "internalNote" text NOT NULL DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS "editTokenHash" text,
  ADD COLUMN IF NOT EXISTS "editTokenExpiresAt" timestamp without time zone;

-- Query/index paths used by the Supabase data layer. These are regular indexes,
-- not concurrently-built indexes, because the reviewed project is small. Do
-- not swap them for CONCURRENTLY inside this transaction.
CREATE INDEX IF NOT EXISTS "Form_userId_updatedAt_idx"
  ON public."Form" ("userId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Form_workspaceId_idx"
  ON public."Form" ("workspaceId");
CREATE INDEX IF NOT EXISTS "Workspace_userId_order_idx"
  ON public."Workspace" ("userId", "order");
CREATE INDEX IF NOT EXISTS "Question_formId_order_idx"
  ON public."Question" ("formId", "order");
CREATE INDEX IF NOT EXISTS "FormEnding_formId_order_idx"
  ON public."FormEnding" ("formId", "order");
CREATE INDEX IF NOT EXISTS "Response_formId_startedAt_idx"
  ON public."Response" ("formId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "Response_formId_isPartial_idx"
  ON public."Response" ("formId", "isPartial");
CREATE INDEX IF NOT EXISTS "Response_formId_status_idx"
  ON public."Response" ("formId", status);
CREATE INDEX IF NOT EXISTS "Answer_questionId_idx"
  ON public."Answer" ("questionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Answer_responseId_questionId_key"
  ON public."Answer" ("responseId", "questionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Response_editTokenHash_key"
  ON public."Response" ("editTokenHash")
  WHERE "editTokenHash" IS NOT NULL;

-- Keep existing timestamp-without-time-zone columns in UTC whenever writes no
-- longer pass through Prisma. Trigger functions are not callable by web roles.
CREATE OR REPLACE FUNCTION public.touch_legacy_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW."updatedAt" = timezone('utc', now());
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['User', 'Workspace', 'Form', 'Question', 'FormEnding'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_legacy_updated_at()',
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.touch_auth_cutover_ledger_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_auth_cutover_ledger_updated_at ON public.auth_cutover_ledger;
CREATE TRIGGER touch_auth_cutover_ledger_updated_at
  BEFORE UPDATE ON public.auth_cutover_ledger
  FOR EACH ROW EXECUTE FUNCTION public.touch_auth_cutover_ledger_updated_at();

REVOKE ALL ON FUNCTION public.touch_legacy_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_auth_cutover_ledger_updated_at() FROM PUBLIC, anon, authenticated;

-- Integrity constraints were checked by 0000a and are validated here. They
-- prevent bad future writes while retaining all reviewed existing data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Question"'::regclass AND conname = 'Question_type_check'
  ) THEN
    ALTER TABLE public."Question"
      ADD CONSTRAINT "Question_type_check"
      CHECK (type IN (
        'short_text', 'long_text', 'multiple_choice', 'dropdown', 'email', 'number',
        'rating', 'opinion_scale', 'yes_no', 'date', 'picture_choice', 'phone',
        'website', 'legal', 'statement', 'ending'
      )) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Response"'::regclass AND conname = 'Response_status_check'
  ) THEN
    ALTER TABLE public."Response"
      ADD CONSTRAINT "Response_status_check"
      CHECK (status IN ('new', 'reviewing', 'qualified', 'follow_up', 'closed')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Form"'::regclass AND conname = 'Form_maxResponses_check'
  ) THEN
    ALTER TABLE public."Form"
      ADD CONSTRAINT "Form_maxResponses_check"
      CHECK ("maxResponses" >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Question"'::regclass
      AND conname = 'Question_type_check'
      AND NOT convalidated
  ) THEN
    ALTER TABLE public."Question" VALIDATE CONSTRAINT "Question_type_check";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Response"'::regclass
      AND conname = 'Response_status_check'
      AND NOT convalidated
  ) THEN
    ALTER TABLE public."Response" VALIDATE CONSTRAINT "Response_status_check";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Form"'::regclass
      AND conname = 'Form_maxResponses_check'
      AND NOT convalidated
  ) THEN
    ALTER TABLE public."Form" VALIDATE CONSTRAINT "Form_maxResponses_check";
  END IF;
END $$;

-- These administrative tables are intentionally inaccessible to anon and
-- authenticated browser clients. The trusted server-only service role is used
-- later, only after it has independently authenticated the caller.
REVOKE ALL ON TABLE public.app_schema_migrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.auth_cutover_ledger FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_schema_migrations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_cutover_ledger TO service_role;
ALTER TABLE public.app_schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_cutover_ledger ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (version, notes)
VALUES (
  '0001_prepare_existing_minimal_schema_cutover',
  'Added the auth UUID bridge and one-time cutover ledger; added compatibility columns, database update triggers, indexes, and validated integrity checks to the reviewed seven-table legacy schema.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
