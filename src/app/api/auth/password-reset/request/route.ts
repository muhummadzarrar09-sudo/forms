import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashResponseEditToken } from '@/lib/crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { enforcePublicRateLimit, publicClientId } from '@/lib/public-rate-limit';

const requestSchema = z.object({ email: z.string().email().max(320) }).strict();
const genericMessage = 'If an account exists for this email, a password reset link will be sent.';

function resetBaseUrl(): string | null {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' || process.env.NODE_ENV !== 'production' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Enumeration-resistant password-reset request endpoint. */
export async function POST(request: NextRequest) {
  try {
    const limit = await enforcePublicRateLimit({
      scope: 'password-reset-request', formId: 'auth', clientId: publicClientId(request.headers),
      maxRequests: 5, windowSeconds: 15 * 60,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many reset requests. Please try again later.' }, {
        status: 429, headers: { 'Retry-After': String(limit.retryAfter) },
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    // Keep invalid and unknown-account requests indistinguishable to callers.
    if (!parsed.success) return NextResponse.json({ message: genericMessage }, { status: 202 });

    const email = parsed.data.email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
    const baseUrl = resetBaseUrl();
    if (user && baseUrl) {
      const rawToken = randomBytes(32).toString('base64url');
      await db.$transaction([
        db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        db.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashResponseEditToken(rawToken),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        }),
      ]);
      // Delivery failure is intentionally not disclosed, to avoid enumeration.
      await sendPasswordResetEmail(user.email, `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`);
    }

    return NextResponse.json({ message: genericMessage }, { status: 202 });
  } catch (error) {
    console.error('Password reset request failed:', error);
    return NextResponse.json({ error: 'Unable to request a password reset' }, { status: 500 });
  }
}
