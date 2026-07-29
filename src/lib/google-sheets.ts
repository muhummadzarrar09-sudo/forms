import { db } from '@/lib/db';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '@/lib/integration-crypto';

export async function googleAccessToken(connectionId: string): Promise<string> {
  const connection = await db.googleConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error('Google connection not found');
  if (connection.encryptedAccessToken && connection.accessTokenExpiresAt && connection.accessTokenExpiresAt > new Date(Date.now() + 60_000)) {
    return decryptIntegrationSecret(connection.encryptedAccessToken);
  }
  const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured');
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: decryptIntegrationSecret(connection.encryptedRefreshToken), grant_type: 'refresh_token' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!response.ok || !token.access_token) throw new Error('Google token refresh failed');
  await db.googleConnection.update({ where: { id: connectionId }, data: { encryptedAccessToken: encryptIntegrationSecret(token.access_token), accessTokenExpiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000) } });
  return token.access_token;
}
