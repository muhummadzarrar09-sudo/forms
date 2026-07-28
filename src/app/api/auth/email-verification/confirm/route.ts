import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashResponseEditToken, verifyResponseEditToken } from '@/lib/crypto';
import { enforcePublicRateLimit, publicClientId } from '@/lib/public-rate-limit';

const schema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

export async function POST(request: NextRequest) {
  try {
    const limit = await enforcePublicRateLimit({
      scope: 'email-verification-confirm', formId: 'auth', clientId: publicClientId(request.headers),
      maxRequests: 10, windowSeconds: 15 * 60,
    });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid or expired verification link.' }, { status: 400 });
    const tokenHash = hashResponseEditToken(parsed.data.token);
    const token = await db.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!token || token.expiresAt <= new Date() || !verifyResponseEditToken(parsed.data.token, token.tokenHash)) {
      return NextResponse.json({ error: 'Invalid or expired verification link.' }, { status: 400 });
    }
    await db.$transaction([
      db.user.update({ where: { id: token.userId }, data: { emailVerified: new Date() } }),
      db.emailVerificationToken.deleteMany({ where: { userId: token.userId } }),
    ]);
    return NextResponse.json({ message: 'Email verified. You can now sign in.' });
  } catch (error) {
    console.error('Email verification failed:', error);
    return NextResponse.json({ error: 'Unable to verify email' }, { status: 500 });
  }
}
