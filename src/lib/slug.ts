import 'server-only';

import { randomBytes } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

/** Generate a URL-friendly slug from a title. */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Ensure slug uniqueness by appending a cryptographically random suffix. This
 * function is server-only because it uses the service-role database client;
 * routes call it only after independently authenticating the caller.
 *
 * The unique database index remains the final race-condition protection. A
 * caller must handle a unique violation by retrying its insert if needed.
 */
export async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  let slug = baseSlug;

  for (let attempts = 0; attempts < 10; attempts += 1) {
    const { data, error } = await admin
      .from('Form')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Unable to check slug availability: ${error.message}`);
    if (!data || data.id === excludeId) return slug;

    slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
  }

  return `${baseSlug}-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
}
