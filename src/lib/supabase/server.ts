import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured');
  }
  return { url, anonKey };
}

/**
 * Request-scoped client carrying the caller's Supabase Auth cookies. Use this
 * only to resolve the caller identity; owner/public data writes stay in the
 * trusted API layer below rather than granting direct browser table access.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = publicSupabaseConfig();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies. Route handlers can, and
          // refresh-token rotation will be persisted there.
        }
      },
    },
  });
}

export type SupabaseAuthUser = {
  id: string;
  email: string;
  name: string;
};

export async function requireSupabaseUser(): Promise<SupabaseAuthUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    name: typeof data.user.user_metadata?.name === 'string' ? data.user.user_metadata.name : '',
  };
}

let adminClient: ReturnType<typeof createClient> | undefined;

/**
 * Server-only data client. SUPABASE_SERVICE_ROLE_KEY must never be exposed to
 * client code or NEXT_PUBLIC_* variables. Every call site must authenticate and
 * authorize the request before using this client because it bypasses RLS.
 */
export function getSupabaseAdminClient() {
  if (!adminClient) {
    const { url } = publicSupabaseConfig();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured on the server');
    adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}
