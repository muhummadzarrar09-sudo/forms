import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, hashResponseEditToken, verifyResponseEditToken } from '@/lib/crypto';
import { enforcePublicRateLimit, publicClientId } from '@/lib/public-rate-limit';

const confirmSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: z.string().min(12).max(1024),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const limit = await enforcePublicRateLimit({
      scope: 'password-reset-confirm', formId: 'auth', clientId: publicClientId(request.headers),
      maxRequests: 10, windowSeconds: 15 * 60,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many reset attempts. Please try again later.' }, {
        status: 429, headers: { 'Retry-After': String(limit.retryAfter) },
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });

    const tokenHash = hashResponseEditToken(parsed.data.token);
    const resetToken = await db.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.expiresAt <= new Date() || !verifyResponseEditToken(parsed.data.token, resetToken.tokenHash)) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
    }

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { password: hashPassword(parsed.data.password), sessionVersion: { increment: 1 } },
      }),
      db.passwordResetToken.delete({ where: { id: resetToken.id } }),
    ]);

    return NextResponse.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Password reset confirmation failed:', error);
    return NextResponse.json({ error: 'Unable to reset password' }, { status: 500 });
  }
}
