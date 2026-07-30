import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canonicalAppUrl } from '@/lib/app-url';

export async function GET() {
  const session = await getServerSession(authOptions);
  const baseUrl = canonicalAppUrl();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!baseUrl || !clientId) return NextResponse.json({ error: 'Google Sheets integration is not configured' }, { status: 503 });
  const state = randomBytes(32).toString('base64url');
  const redirectUri = `${baseUrl}/api/integrations/google/callback`;
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('access_type', 'offline');
  authorizationUrl.searchParams.set('prompt', 'consent');
  authorizationUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file');
  authorizationUrl.searchParams.set('state', state);
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set('forms_google_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}
