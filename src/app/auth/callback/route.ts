import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase public configuration is missing');
  return { url, anonKey };
}

function safeNextPath(candidate: string | null) {
  // Prevent an Auth redirect parameter from becoming an open redirect.
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/reset-password';
  }
  return candidate;
}

/**
 * Exchanges Supabase's PKCE recovery/auth code for HttpOnly auth cookies, then
 * sends the browser to the local recovery screen. Add this exact route to the
 * Supabase Auth redirect allowlist; never put a service-role key here.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const destination = new URL(safeNextPath(requestUrl.searchParams.get('next')), requestUrl.origin);

  let response = NextResponse.redirect(destination);
  if (!code) {
    destination.searchParams.set('error', 'invalid_recovery_link');
    return NextResponse.redirect(destination);
  }

  try {
    const { url, anonKey } = getPublicConfig();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagate refreshed/session cookies to the response. Updating the
          // request copy lets subsequent calls in this route see the same set.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.redirect(destination);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      destination.searchParams.set('error', 'invalid_recovery_link');
      return NextResponse.redirect(destination);
    }

    return response;
  } catch {
    destination.searchParams.set('error', 'invalid_recovery_link');
    return NextResponse.redirect(destination);
  }
}
