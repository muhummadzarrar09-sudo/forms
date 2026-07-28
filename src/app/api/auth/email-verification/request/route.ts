import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { issueEmailVerification } from '@/lib/email-verification';
import { enforcePublicRateLimit, publicClientId } from '@/lib/public-rate-limit';

const schema = z.object({ email: z.string().email().max(320) }).strict();
const message = 'If an unverified account exists for this email, a verification link will be sent.';

export async function POST(request: NextRequest) {
  try {
    const limit = await enforcePublicRateLimit({
      scope: 'email-verification-request', formId: 'auth', clientId: publicClientId(request.headers),
      maxRequests: 5, windowSeconds: 15 * 60,
    });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message }, { status: 202 });
    const user = await db.user.findUnique({
      where: { email: parsed.data.email.trim().toLowerCase() },
      select: { id: true, email: true, emailVerified: true },
    });
    if (user && !user.emailVerified) await issueEmailVerification(user);
    return NextResponse.json({ message }, { status: 202 });
  } catch (error) {
    console.error('Verification request failed:', error);
    return NextResponse.json({ error: 'Unable to send verification email' }, { status: 500 });
  }
}
