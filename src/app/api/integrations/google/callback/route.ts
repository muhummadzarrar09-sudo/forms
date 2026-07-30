import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canonicalAppUrl } from '@/lib/app-url';
import { db } from '@/lib/db';
import { encryptIntegrationSecret } from '@/lib/integration-crypto';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const baseUrl = canonicalAppUrl();
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expected = request.cookies.get('forms_google_oauth_state')?.value;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/?integration=google&error=${encodeURIComponent(reason)}`, baseUrl || request.nextUrl.origin));
  if (!session?.user?.id || !baseUrl || !code || !state || !expected) return fail('connection_failed');
  const a = Buffer.from(state), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail('invalid_state');
  const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('not_configured');
  try {
    const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${baseUrl}/api/integrations/google/callback`, grant_type: 'authorization_code' });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tokenResponse.ok || !token.refresh_token) return fail('token_exchange_failed');
    await db.googleConnection.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, encryptedRefreshToken: encryptIntegrationSecret(token.refresh_token), encryptedAccessToken: token.access_token ? encryptIntegrationSecret(token.access_token) : null, accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null },
      update: { encryptedRefreshToken: encryptIntegrationSecret(token.refresh_token), encryptedAccessToken: token.access_token ? encryptIntegrationSecret(token.access_token) : null, accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null },
    });
    const response = NextResponse.redirect(new URL('/?integration=google&connected=1', baseUrl));
    response.cookies.delete('forms_google_oauth_state');
    return response;
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    return fail('connection_failed');
  }
}
