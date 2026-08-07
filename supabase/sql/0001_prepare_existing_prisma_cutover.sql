-- EXISTING-DATABASE PREPARATION — run only after 0000 preflight is reviewed.
-- This is additive/non-destructive. It does NOT create auth.users, does NOT
-- enable RLS yet, and does NOT drop legacy password/token data. Those actions
-- occur only after every legacy account is mapped to Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.app_schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  applied_by uuid references auth.users(id),
  notes text not null default ''
);

-- Keep the legacy CUID primary key while adding a one-to-one Supabase Auth UUID.
-- Existing authUserId values are nullable until the forced-reset provisioning
-- script has created/linked every account.
alter table public."User"
  add column if not exists "authUserId" uuid;

create unique index if not exists "User_authUserId_key"
  on public."User" ("authUserId")
  where "authUserId" is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'User_authUserId_fkey'
      and conrelid = 'public."User"'::regclass
  ) then
    alter table public."User"
      add constraint "User_authUserId_fkey"
      foreign key ("authUserId") references auth.users(id)
      on delete set null not valid;
  end if;
end $$;

-- This ledger is the controlled hand-off between the old PBKDF2 accounts and
-- Supabase Auth. It intentionally stores no password/reset token.
create table if not exists public.auth_cutover_ledger (
  legacy_user_id text primary key references public."User"(id) on delete cascade,
  email text not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  status text not null default 'pending',
  provisioned_at timestamptz,
  reset_sent_at timestamptz,
  completed_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_cutover_ledger_status_check
    check (status in ('pending', 'provisioned', 'reset_sent', 'completed', 'failed'))
);

insert into public.auth_cutover_ledger (legacy_user_id, email)
select id, lower(email)
from public."User"
on conflict (legacy_user_id) do update
set email = excluded.email,
    updated_at = now();

-- Indexes currently missing from the Prisma schema but required by existing
-- endpoint/cleanup/query paths.
create index if not exists "Response_formId_status_idx"
  on public."Response" ("formId", status);
create index if not exists "PublicRateLimit_updatedAt_idx"
  on public."PublicRateLimit" ("updatedAt");
create index if not exists "GoogleSheetSyncEvent_responseId_idx"
  on public."GoogleSheetSyncEvent" ("responseId");

-- Make timestamp maintenance database-owned so future PostgREST/SQL writes do
-- not leave stale updatedAt values. Existing camelCase columns stay intact to
-- preserve current data during the transition.
create or replace function public.touch_legacy_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'User', 'Form', 'Workspace', 'Question', 'FormEnding',
    'GoogleConnection', 'GoogleSheetDestination', 'GoogleSheetSyncEvent',
    'PublicRateLimit'
  ] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', table_name);
    execute format(
      'create trigger touch_updated_at before update on public.%I for each row execute function public.touch_legacy_updated_at()',
      table_name
    );
  end loop;
end $$;

-- Add constraints as NOT VALID first. Inspect/fix 0000 output before validating
-- them in a later script; this prevents an existing data surprise from causing a
-- partially applied cutover.
alter table public."Question"
  drop constraint if exists "Question_type_check";
alter table public."Question"
  add constraint "Question_type_check"
  check (type in (
    'short_text', 'long_text', 'multiple_choice', 'dropdown', 'email', 'number',
    'rating', 'opinion_scale', 'yes_no', 'date', 'picture_choice', 'phone',
    'website', 'legal', 'statement', 'ending'
  )) not valid;

alter table public."Response"
  drop constraint if exists "Response_status_check";
alter table public."Response"
  add constraint "Response_status_check"
  check (status in ('new', 'reviewing', 'qualified', 'follow_up', 'closed')) not valid;

alter table public."GoogleSheetSyncEvent"
  drop constraint if exists "GoogleSheetSyncEvent_status_check";
alter table public."GoogleSheetSyncEvent"
  add constraint "GoogleSheetSyncEvent_status_check"
  check (status in ('pending', 'processing', 'delivered', 'failed')) not valid;

insert into public.app_schema_migrations (version, notes)
values ('0001_prepare_existing_prisma_cutover', 'Added auth bridge, cutover ledger, indexes, timestamp triggers, and NOT VALID integrity checks.')
on conflict (version) do nothing;
