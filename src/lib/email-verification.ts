import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { hashResponseEditToken } from '@/lib/crypto';
import { sendVerificationEmail } from '@/lib/email';
import { canonicalAppUrl } from '@/lib/app-url';

/** Issue a single-use 24-hour email-verification credential. */
export async function issueEmailVerification(user: { id: string; email: string }): Promise<boolean> {
  const baseUrl = canonicalAppUrl();
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
