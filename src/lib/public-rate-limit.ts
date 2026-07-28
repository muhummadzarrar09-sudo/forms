import { createHash } from 'crypto';
import { db } from '@/lib/db';

/**
 * Database-backed limiter for anonymous endpoints. Unlike the legacy in-memory
 * login limiter, this state is shared by every application instance and survives
 * restarts. The caller supplies an edge-sanitized client identity; never persist
 * raw IP addresses in the database.
 */
export async function enforcePublicRateLimit(options: {
  scope: string;
  formId: string;
  clientId: string;
  maxRequests: number;
  windowSeconds: number;
}): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const now = new Date();
  const windowMs = options.windowSeconds * 1000;
  const key = rateLimitKey(options.scope, options.formId, options.clientId);

  return db.$transaction(async (tx) => {
    // Serialize all writers for this hashed key. PostgreSQL advisory locks are
    // transaction-scoped, parameterized, and work across application instances.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const existing = await tx.publicRateLimit.findUnique({ where: { key } });
    const startsNewWindow = !existing || now.getTime() - existing.windowStart.getTime() >= windowMs;

    if (startsNewWindow) {
      await tx.publicRateLimit.upsert({
        where: { key },
        create: { key, windowStart: now, count: 1 },
        update: { windowStart: now, count: 1 },
      });
      return { allowed: true };
    }

    if (existing.count >= options.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((windowMs - (now.getTime() - existing.windowStart.getTime())) / 1000)),
      };
    }

    await tx.publicRateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { allowed: true };
  });
}

/**
 * Caddy overwrites X-Real-IP in the supplied production configuration. Deployments
 * without a trusted edge deliberately use a shared anonymous bucket rather than
 * trusting a spoofable forwarded header.
 */
function rateLimitKey(scope: string, resourceId: string, clientId: string): string {
  return createHash('sha256').update(`${scope}:${resourceId}:${clientId}`).digest('hex');
}

export async function clearPublicRateLimit(scope: string, resourceId: string, clientId: string): Promise<void> {
  await db.publicRateLimit.deleteMany({ where: { key: rateLimitKey(scope, resourceId, clientId) } });
}

export function publicClientId(headers: Headers): string {
  return process.env.TRUST_PROXY_HEADERS === 'true'
    ? (headers.get('x-real-ip') || 'anonymous')
    : 'anonymous';
}
