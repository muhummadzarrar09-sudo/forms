import { randomBytes } from 'crypto';
import { db } from '@/lib/db';

/** Generate a URL-friendly slug from a title. */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Ensure slug uniqueness by appending a short random suffix if needed.
 * Uses `crypto.randomBytes` so suffixes are not predictable.
 *
 * NOTE: The `slug` column has a GLOBAL @unique constraint in Prisma, so we
 * must check across ALL users — not just the current one — to avoid
 * unique-violation errors.
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let attempts = 0;

  while (attempts < 10) {
    const existing = await db.form.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;

    // Append a short cryptographically-random suffix
    const suffix = randomBytes(3).toString('hex');
    slug = `${baseSlug}-${suffix}`;
    attempts++;
  }

  // Fallback: use timestamp-based suffix
  return `${baseSlug}-${Date.now().toString(36)}`;
}
