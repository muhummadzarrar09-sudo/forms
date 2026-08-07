import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured');
  }
  return { url, anonKey };
}

/** Browser client uses only the publishable/anon key and the Supabase Auth cookie. */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, anonKey } = publicSupabaseConfig();
    browserClient = createBrowserClient(url, anonKey, {
      // Recovery links arrive at the server callback as a one-time PKCE code;
      // the callback exchanges it for HttpOnly cookies before redirecting.
      auth: { flowType: 'pkce' },
    });
  }
  return browserClient;
}
