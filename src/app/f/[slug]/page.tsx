import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { serializeForm } from '@/lib/api-serialization';
import { SlugFormFiller } from './slug-form-filler';

interface PageProps {
  params: Promise<{ slug: string }>;
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
