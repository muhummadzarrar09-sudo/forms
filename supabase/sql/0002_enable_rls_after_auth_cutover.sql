-- RLS CUTOVER — run only after the provisioning script has populated
-- "User"."authUserId" for EVERY account in auth_cutover_ledger.
-- This script intentionally gives browser clients no direct access to raw form,
-- response, hidden-field, scoring, or token data. The Next backend will use a
-- server-only service-role client after it independently verifies Supabase Auth.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."User" WHERE "authUserId" IS NULL) THEN
    RAISE EXCEPTION 'Refusing RLS cutover: legacy User rows still lack authUserId mappings.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.auth_cutover_ledger WHERE status <> 'completed') THEN
    RAISE EXCEPTION 'Refusing RLS cutover: auth_cutover_ledger has incomplete accounts.';
  END IF;
END $$;

-- Validate the bridge FK and data checks only after preflight remediation.
alter table public."User" validate constraint "User_authUserId_fkey";
alter table public."Question" validate constraint "Question_type_check";
alter table public."Response" validate constraint "Response_status_check";
alter table public."GoogleSheetSyncEvent" validate constraint "GoogleSheetSyncEvent_status_check";

-- Helper used by policies. It returns the legacy CUID associated with the
-- Supabase Auth UUID in the current JWT. It exposes no other user's identifier.
create or replace function public.current_legacy_user_id()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select id
  from public."User"
  where "authUserId" = auth.uid()
  limit 1;
$$;

revoke all on function public.current_legacy_user_id() from public;
grant execute on function public.current_legacy_user_id() to anon, authenticated, service_role;

-- Turn on and force RLS for every application table. Service role is allowed
-- only in trusted server code; browser clients use anon/authenticated keys.
alter table public."User" enable row level security;
alter table public."Form" enable row level security;
alter table public."Workspace" enable row level security;
alter table public."Question" enable row level security;
alter table public."Response" enable row level security;
alter table public."Answer" enable row level security;
alter table public."FormEnding" enable row level security;
alter table public."PasswordResetToken" enable row level security;
alter table public."EmailVerificationToken" enable row level security;
alter table public."GoogleConnection" enable row level security;
alter table public."GoogleSheetDestination" enable row level security;
alter table public."GoogleSheetSyncEvent" enable row level security;
alter table public."PublicRateLimit" enable row level security;
alter table public.auth_cutover_ledger enable row level security;

alter table public."User" force row level security;
alter table public."Form" force row level security;
alter table public."Workspace" force row level security;
alter table public."Question" force row level security;
alter table public."Response" force row level security;
alter table public."Answer" force row level security;
alter table public."FormEnding" force row level security;
alter table public."PasswordResetToken" force row level security;
alter table public."EmailVerificationToken" force row level security;
alter table public."GoogleConnection" force row level security;
alter table public."GoogleSheetDestination" force row level security;
alter table public."GoogleSheetSyncEvent" force row level security;
alter table public."PublicRateLimit" force row level security;
alter table public.auth_cutover_ledger force row level security;

-- Remove any prior policy names that this repository owns. Do not drop unknown
-- production policies without comparing 0000 preflight output.
drop policy if exists user_self on public."User";
drop policy if exists form_owner on public."Form";
drop policy if exists workspace_owner on public."Workspace";
drop policy if exists question_owner on public."Question";
drop policy if exists response_owner on public."Response";
drop policy if exists answer_owner on public."Answer";
drop policy if exists ending_owner on public."FormEnding";
drop policy if exists password_reset_owner on public."PasswordResetToken";
drop policy if exists verification_owner on public."EmailVerificationToken";
drop policy if exists google_connection_owner on public."GoogleConnection";
drop policy if exists google_destination_owner on public."GoogleSheetDestination";
drop policy if exists google_event_owner on public."GoogleSheetSyncEvent";

create policy user_self on public."User"
  for select to authenticated
  using ("authUserId" = auth.uid());

create policy form_owner on public."Form"
  for all to authenticated
  using ("userId" = public.current_legacy_user_id())
  with check ("userId" = public.current_legacy_user_id());

create policy workspace_owner on public."Workspace"
  for all to authenticated
  using ("userId" = public.current_legacy_user_id())
  with check ("userId" = public.current_legacy_user_id());

create policy question_owner on public."Question"
  for all to authenticated
  using (exists (
    select 1 from public."Form" f
    where f.id = "Question"."formId"
      and f."userId" = public.current_legacy_user_id()
  ))
  with check (exists (
    select 1 from public."Form" f
    where f.id = "Question"."formId"
      and f."userId" = public.current_legacy_user_id()
  ));

create policy ending_owner on public."FormEnding"
  for all to authenticated
  using (exists (
    select 1 from public."Form" f
    where f.id = "FormEnding"."formId"
      and f."userId" = public.current_legacy_user_id()
  ))
  with check (exists (
    select 1 from public."Form" f
    where f.id = "FormEnding"."formId"
      and f."userId" = public.current_legacy_user_id()
  ));

create policy response_owner on public."Response"
  for all to authenticated
  using (exists (
    select 1 from public."Form" f
    where f.id = "Response"."formId"
      and f."userId" = public.current_legacy_user_id()
  ))
  with check (exists (
    select 1 from public."Form" f
    where f.id = "Response"."formId"
      and f."userId" = public.current_legacy_user_id()
  ));

create policy answer_owner on public."Answer"
  for all to authenticated
  using (exists (
    select 1
    from public."Response" r
    join public."Form" f on f.id = r."formId"
    where r.id = "Answer"."responseId"
      and f."userId" = public.current_legacy_user_id()
  ))
  with check (exists (
    select 1
    from public."Response" r
    join public."Form" f on f.id = r."formId"
    where r.id = "Answer"."responseId"
      and f."userId" = public.current_legacy_user_id()
  ));

-- Browser clients never need raw reset/verification/rate-limit/cutover data.
-- No policy means authenticated/anon requests are denied; trusted backend uses
-- service role only after it verifies the caller/session itself.
create policy google_connection_owner on public."GoogleConnection"
  for all to authenticated
  using ("userId" = public.current_legacy_user_id())
  with check ("userId" = public.current_legacy_user_id());

create policy google_destination_owner on public."GoogleSheetDestination"
  for all to authenticated
  using (exists (
    select 1 from public."Form" f
    where f.id = "GoogleSheetDestination"."formId"
      and f."userId" = public.current_legacy_user_id()
  ))
  with check (exists (
    select 1 from public."Form" f
    where f.id = "GoogleSheetDestination"."formId"
      and f."userId" = public.current_legacy_user_id()
  ));

create policy google_event_owner on public."GoogleSheetSyncEvent"
  for all to authenticated
  using (exists (
    select 1
    from public."GoogleSheetDestination" d
    join public."Form" f on f.id = d."formId"
    where d.id = "GoogleSheetSyncEvent"."destinationId"
      and f."userId" = public.current_legacy_user_id()
  ))
  with check (exists (
    select 1
    from public."GoogleSheetDestination" d
    join public."Form" f on f.id = d."formId"
    where d.id = "GoogleSheetSyncEvent"."destinationId"
      and f."userId" = public.current_legacy_user_id()
  ));

insert into public.app_schema_migrations (version, notes)
values ('0002_enable_rls_after_auth_cutover', 'Enabled and forced RLS after all legacy users were linked to Supabase Auth.')
on conflict (version) do nothing;
