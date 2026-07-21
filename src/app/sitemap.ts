import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

// Published slugs are runtime data. Do not turn a transient database outage at
// build time into a deployment failure or ship a stale static sitemap.
export const dynamic = 'force-dynamic';

function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = appUrl();
  const forms = await db.form.findMany({
    where: { published: true, slug: { not: null } },
    select: { slug: true, updatedAt: true },
  });

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    ...forms.flatMap((form) => form.slug ? [{
      url: `${baseUrl}/f/${encodeURIComponent(form.slug)}`,
      lastModified: form.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }] : []),
  ];
}
