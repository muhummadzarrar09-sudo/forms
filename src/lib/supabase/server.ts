import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

export type SupabaseLegacyUser = SupabaseAuthUser & {
  // Existing application ownership remains CUID-based during the transition.
  // This bridge is populated by the reviewed SQL/Auth cutover, not from any
  // client-provided ID.
  legacyUserId: string;
};

export async function requireSupabaseUser(): Promise<SupabaseAuthUser | null> {
  const supabase = await getSupabaseServerClient();
  // getUser validates the access token with Supabase Auth; do not trust a
  // decoded browser cookie/session value for authorization.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    name: typeof data.user.user_metadata?.name === 'string' ? data.user.user_metadata.name : '',
  };
}

/**
 * Resolves a verified Supabase Auth identity to the existing CUID owner row.
 * Every protected legacy-table operation must use this instead of accepting a
 * userId from a request. It deliberately uses the service-role client only
 * after requireSupabaseUser() has independently authenticated the caller.
 */
export async function requireSupabaseLegacyUser(): Promise<SupabaseLegacyUser | null> {
  const authUser = await requireSupabaseUser();
  if (!authUser) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('User')
    .select('id,name,authUserId')
    .eq('authUserId', authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve the authenticated application user: ${error.message}`);
  }
  if (!data || data.authUserId !== authUser.id) return null;

  return {
    ...authUser,
    legacyUserId: data.id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name : authUser.name,
  };
}

// Schema-generated types are introduced after the SQL cutover is applied. Until
// then, keep this trusted server client explicitly untyped rather than letting
// the SDK infer `never` for every quoted legacy table.
let adminClient: SupabaseClient<any> | undefined;

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
    adminClient = createClient<any>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}
