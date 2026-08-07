#!/usr/bin/env node
/**
 * One-time, SERVER-ONLY existing-user cutover helper.
 *
 * Prerequisites:
 *   1. Run the reviewed project-specific preflight and preparation SQL.
 *      For the current seven-table production schema, that is:
 *      - supabase/sql/0001_prepare_existing_minimal_schema_cutover.sql
 *      - supabase/sql/0001a_verify_existing_minimal_schema_cutover.sql
 *   2. Configure Supabase Auth email delivery and the exact recovery redirect.
 *   3. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL),
 *      SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_AUTH_REDIRECT_TO only in a
 *      trusted shell/CI secret store.
 *
 * This script never prints emails, passwords, access tokens, reset URLs, user
 * IDs, or service keys. It is a dry run by default. With --apply it creates a
 * random unusable temporary password, links auth.users UUID -> legacy CUID, and
 * sends the mandatory Supabase password-recovery email.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redirectTo = process.env.SUPABASE_AUTH_REDIRECT_TO;

if (!url || !serviceRoleKey || !redirectTo) {
  console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_AUTH_REDIRECT_TO.');
  process.exit(1);
}

try {
  new URL(redirectTo);
} catch {
  console.error('SUPABASE_AUTH_REDIRECT_TO must be an absolute URL allowed by Supabase Auth redirect settings.');
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const resumableStatuses = ['pending', 'provisioned', 'reset_sent', 'failed'];
const { data: pendingRows, error: pendingError } = await admin
  .from('auth_cutover_ledger')
  .select('legacy_user_id,email,auth_user_id,status')
  .in('status', resumableStatuses)
  .order('created_at', { ascending: true });

if (pendingError) {
  console.error(`Could not read auth_cutover_ledger: ${pendingError.message}`);
  process.exit(1);
}

function normalizedEmail(value) {
  return value.trim().toLowerCase();
}

async function findAuthUserByEmail(email) {
  const normalized = normalizedEmail(email);
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list existing Supabase Auth users: ${error.message}`);
    const match = data.users.find((user) => user.email && normalizedEmail(user.email) === normalized);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

async function getLegacyUser(legacyUserId) {
  const { data, error } = await admin
    .from('User')
    .select('id,email,authUserId')
    .eq('id', legacyUserId)
    .maybeSingle();
  if (error) throw new Error(`Could not load legacy account: ${error.message}`);
  if (!data) throw new Error('Legacy account is missing');
  return data;
}

async function updateLedger(legacyUserId, update) {
  const { error } = await admin
    .from('auth_cutover_ledger')
    .update(update)
    .eq('legacy_user_id', legacyUserId);
  if (error) throw new Error(`Could not update cutover ledger: ${error.message}`);
}

async function resolveAuthUser(row, legacyUser) {
  const expectedEmail = normalizedEmail(row.email);
  if (normalizedEmail(legacyUser.email) !== expectedEmail) {
    throw new Error('Legacy email no longer matches the approved cutover ledger');
  }

  if (row.auth_user_id) {
    const { data, error } = await admin.auth.admin.getUserById(row.auth_user_id);
    if (error || !data.user) {
      throw new Error('Ledger points to a missing Supabase Auth account; manual review is required');
    }
    if (!data.user.email || normalizedEmail(data.user.email) !== expectedEmail) {
      throw new Error('Ledger Auth account email does not match the legacy account; manual review is required');
    }
    return data.user;
  }

  const existing = await findAuthUserByEmail(row.email);
  if (existing) {
    // A pre-existing account not explicitly tied to this legacy ID could belong
    // to a different migration/application. Do not silently take it over.
    const linkedLegacyId = existing.user_metadata?.legacy_user_id;
    if (linkedLegacyId !== row.legacy_user_id) {
      throw new Error('An unlinked Auth account already uses this email; manual review is required');
    }
    return existing;
  }

  const temporaryPassword = randomBytes(48).toString('base64url');
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: row.email,
    password: temporaryPassword,
    // Admin-created users do not receive a signup confirmation automatically.
    // The required recovery email below is the only usable credential path for
    // this reviewed legacy account.
    email_confirm: true,
    user_metadata: {
      legacy_user_id: row.legacy_user_id,
      forced_password_reset: true,
    },
  });

  if (createError || !created.user) {
    throw new Error(createError?.message || 'Supabase Auth did not return a created user');
  }
  return created.user;
}

const rows = pendingRows || [];
console.log(`${apply ? 'Applying' : 'Dry run:'} ${rows.length} legacy account(s) require resumable Supabase Auth provisioning.`);
if (!apply) {
  console.log('Run again with --apply only after verifying Supabase Auth email templates, redirect allowlist, and the SQL verification output.');
  process.exit(0);
}

let completed = 0;
let failed = 0;
for (const row of rows) {
  try {
    const legacyUser = await getLegacyUser(row.legacy_user_id);
    const authUser = await resolveAuthUser(row, legacyUser);

    if (legacyUser.authUserId && legacyUser.authUserId !== authUser.id) {
      throw new Error('Legacy account is already linked to a different Auth UUID; manual review is required');
    }

    if (!legacyUser.authUserId) {
      const { data: mappedRows, error: mappingError } = await admin
        .from('User')
        .update({ authUserId: authUser.id })
        .eq('id', row.legacy_user_id)
        .is('authUserId', null)
        .select('id');
      if (mappingError) throw new Error(`Legacy user mapping failed: ${mappingError.message}`);
      if (!mappedRows || mappedRows.length !== 1) {
        throw new Error('Legacy user mapping did not update exactly one account; manual review is required');
      }
    }

    const provisionedAt = new Date().toISOString();
    await updateLedger(row.legacy_user_id, {
      auth_user_id: authUser.id,
      status: 'provisioned',
      provisioned_at: provisionedAt,
      last_error: '',
    });

    const { error: resetError } = await admin.auth.resetPasswordForEmail(row.email, { redirectTo });
    if (resetError) throw new Error(`Recovery email failed: ${resetError.message}`);

    const sentAt = new Date().toISOString();
    await updateLedger(row.legacy_user_id, {
      auth_user_id: authUser.id,
      status: 'completed',
      reset_sent_at: sentAt,
      completed_at: sentAt,
      last_error: '',
    });
    completed += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown provisioning failure';
    try {
      await updateLedger(row.legacy_user_id, { status: 'failed', last_error: message });
    } catch {
      // Do not leak ledger/database details to stdout. The final summary still
      // makes it clear that manual review is required.
    }
  }
}

console.log(`Finished. completed=${completed}; failed=${failed}. Review the aggregate ledger status before enabling the Supabase Auth runtime.`);
if (failed) process.exitCode = 2;
