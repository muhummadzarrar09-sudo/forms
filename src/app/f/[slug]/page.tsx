import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { serializeForm } from '@/lib/api-serialization';
import { SlugFormFiller } from './slug-form-filler';

interface PageProps {
  params: Promise<{ slug: string }>;
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

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const ogImageUrl = `${baseUrl}/api/og?slug=${encodeURIComponent(slug)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/f/${slug}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SlugFormPage({ params }: PageProps) {
  const { slug } = await params;

  // Look up the form by slug
  const form = await db.form.findUnique({
    where: { slug },
    include: {
      _count: { select: { responses: true } },
      questions: { orderBy: { order: 'asc' } },
      endings: { orderBy: { order: 'asc' } },
      workspace: true,
    },
  });

  if (!form) {
    notFound();
  }

  // Only show published forms via slug URL
  if (!form.published) {
    notFound();
  }

  const serializedForm = serializeForm(form);

  return <SlugFormFiller form={serializedForm} />;
}
