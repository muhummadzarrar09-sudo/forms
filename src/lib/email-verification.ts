import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { hashResponseEditToken } from '@/lib/crypto';
import { sendVerificationEmail } from '@/lib/email';

function appBaseUrl(): string | null {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' || process.env.NODE_ENV !== 'production' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Issue a single-use 24-hour email-verification credential. */
export async function issueEmailVerification(user: { id: string; email: string }): Promise<boolean> {
  const baseUrl = appBaseUrl();
  if (!baseUrl) return false;
  const rawToken = randomBytes(32).toString('base64url');
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    db.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResponseEditToken(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  return sendVerificationEmail(user.email, `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`);
}
