#!/usr/bin/env node
/**
 * One-time, SERVER-ONLY existing-user cutover helper.
 *
 * Prerequisites:
 *   1. Run supabase/sql/0000_preflight_existing_prisma_database.sql.
 *   2. Run supabase/sql/0001_prepare_existing_prisma_cutover.sql.
 *   3. Configure Supabase Auth email + the recovery redirect URL.
 *
 * This script never prints passwords, access tokens, reset URLs, or service
 * keys. It creates a random unusable temporary password, links the returned
 * auth.users UUID to the legacy User row, and asks Supabase Auth to send the
 * mandatory recovery email. It is dry-run by default; pass --apply to mutate.
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

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const { data: pendingRows, error: pendingError } = await admin
  .from('auth_cutover_ledger')
  .select('legacy_user_id,email,auth_user_id,status')
  .in('status', ['pending', 'failed'])
  .order('created_at', { ascending: true });

if (pendingError) {
  console.error(`Could not read auth_cutover_ledger: ${pendingError.message}`);
  process.exit(1);
}

async function findAuthUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list existing Supabase Auth users: ${error.message}`);
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

const rows = pendingRows || [];
console.log(`${apply ? 'Applying' : 'Dry run:'} ${rows.length} legacy account(s) require Supabase Auth provisioning.`);
if (!apply) {
  console.log('Run again with --apply only after verifying Supabase Auth email templates and redirect allowlist.');
  process.exit(0);
}

let provisioned = 0;
let failed = 0;
for (const row of rows) {
  const temporaryPassword = randomBytes(48).toString('base64url');
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: row.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { legacy_user_id: row.legacy_user_id, forced_password_reset: true },
    });
    const authUser = created.user || (createError ? await findAuthUserByEmail(row.email) : null);
    if (!authUser) {
      throw new Error(createError?.message || 'Supabase Auth did not return a user');
    }

    const authUserId = authUser.id;
    const { error: legacyUpdateError } = await admin
      .from('User')
      .update({ authUserId })
      .eq('id', row.legacy_user_id)
      .is('authUserId', null);
    if (legacyUpdateError) throw new Error(`Legacy user mapping failed: ${legacyUpdateError.message}`);

    const { error: resetError } = await admin.auth.resetPasswordForEmail(row.email, { redirectTo });
    if (resetError) throw new Error(`Recovery email failed: ${resetError.message}`);

    const { error: ledgerError } = await admin
      .from('auth_cutover_ledger')
      .update({
        auth_user_id: authUserId,
        status: 'completed',
        provisioned_at: new Date().toISOString(),
        reset_sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        last_error: '',
      })
      .eq('legacy_user_id', row.legacy_user_id);
    if (ledgerError) throw new Error(`Cutover ledger update failed: ${ledgerError.message}`);

    provisioned += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown provisioning failure';
    await admin
      .from('auth_cutover_ledger')
      .update({ status: 'failed', last_error: message })
      .eq('legacy_user_id', row.legacy_user_id);
  }
}

console.log(`Finished. provisioned=${provisioned}; failed=${failed}. Review auth_cutover_ledger before running 0002 RLS.`);
if (failed) process.exitCode = 2;
