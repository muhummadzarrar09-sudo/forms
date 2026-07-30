import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { serializePublicForm } from '@/lib/api-serialization';
import { SlugFormFiller } from './slug-form-filler';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getBaseUrl(): string {
  // Explicit override wins for production custom domains.
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  // Vercel sets this automatically for every deployment.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function safePreviewImage(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const form = await db.form.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      welcomeTitle: true,
      welcomeMessage: true,
      metaTitle: true,
      metaDescription: true,
      buttonColor: true,
      backgroundColor: true,
      coverUrl: true,
      published: true,
      _count: { select: { questions: true } },
    },
  });

  if (!form || !form.published) {
    return { title: 'Form not found' };
  }

  const title = form.metaTitle?.trim() || form.welcomeTitle?.trim() || form.title;
  const description =
    form.metaDescription?.trim() ||
    form.welcomeMessage?.trim() ||
    form.description?.trim() ||
    `${form._count.questions} question${form._count.questions !== 1 ? 's' : ''} · Takes less than 2 minutes`;

  const baseUrl = getBaseUrl();
  const generatedOgImageUrl = `${baseUrl}/api/og?slug=${encodeURIComponent(slug)}`;
  // Every published form can opt into a branded public preview using its
  // HTTPS cover image. The generated OG card remains a reliable fallback.
  const customPreview = safePreviewImage(form.coverUrl);
  const socialImages = customPreview
    ? [{ url: customPreview, alt: title }]
    : [{ url: generatedOgImageUrl, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/f/${slug}`,
      images: socialImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [customPreview || generatedOgImageUrl],
    },
  };
}

export default async function SlugFormPage({ params }: PageProps) {
  const { slug } = await params;

  const form = await db.form.findUnique({
    where: { slug },
    include: {
      _count: { select: { responses: true } },
      questions: { orderBy: { order: 'asc' } },
      endings: { orderBy: { order: 'asc' } },
      workspace: true,
    },
  });

  if (!form) notFound();
  if (!form.published) notFound();

  const serializedForm = serializePublicForm(form);
  return <SlugFormFiller form={serializedForm} />;
}
