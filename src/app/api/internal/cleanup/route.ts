import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export function authorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Authenticated maintenance endpoint for a daily scheduler. No data is returned;
 * only expired, unusable credentials and abandoned drafts are removed.
 */
export async function POST(request: NextRequest) {
  if (!authorizedCronRequest(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const now = new Date();
    const staleRateLimitBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [passwordTokens, verificationTokens, drafts, rateLimits] = await db.$transaction([
      db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.response.deleteMany({ where: { isPartial: true, editTokenExpiresAt: { lt: now } } }),
      db.publicRateLimit.deleteMany({ where: { updatedAt: { lt: staleRateLimitBefore } } }),
    ]);
    return NextResponse.json({
      deleted: {
        passwordTokens: passwordTokens.count,
        verificationTokens: verificationTokens.count,
        expiredDrafts: drafts.count,
        rateLimitBuckets: rateLimits.count,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
