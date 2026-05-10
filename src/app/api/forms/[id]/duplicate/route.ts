import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/forms/[id]/duplicate - Duplicate a form with all its questions
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find the original form with its questions
    const originalForm = await db.form.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });

    if (!originalForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Create the duplicated form
    const duplicatedForm = await db.form.create({
      data: {
        title: `Copy of ${originalForm.title}`,
        description: originalForm.description,
        published: false, // Duplicates are always drafts
        favorite: false, // Don't copy favorite
        archived: false, // Don't copy archived
        tags: originalForm.tags, // Copy tags as-is (already JSON string)
        welcomeTitle: originalForm.welcomeTitle,
        welcomeMessage: originalForm.welcomeMessage,
        endingTitle: originalForm.endingTitle,
        endingMessage: originalForm.endingMessage,
        theme: originalForm.theme,
        backgroundColor: originalForm.backgroundColor,
        textColor: originalForm.textColor,
        buttonColor: originalForm.buttonColor,
        buttonTextColor: originalForm.buttonTextColor,
        fontFamily: originalForm.fontFamily,
        logoUrl: originalForm.logoUrl,
        coverUrl: originalForm.coverUrl,
        progressbar: originalForm.progressbar,
        showQuestionNumbers: originalForm.showQuestionNumbers,
        allowBackNavigation: originalForm.allowBackNavigation,
        questions: {
          create: originalForm.questions.map((q) => ({
            type: q.type,
            title: q.title,
            description: q.description,
            required: q.required,
            order: q.order,
            options: q.options,
            imageUrls: q.imageUrls,
            settings: q.settings,
            logic: q.logic || '[]',
            placeholder: q.placeholder,
          })),
        },
      },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
      },
    });

    const serialized = {
      ...duplicatedForm,
      tags: JSON.parse(duplicatedForm.tags || '[]'),
      questions: duplicatedForm.questions.map((q) => ({
        ...q,
        options: JSON.parse(q.options),
        imageUrls: JSON.parse(q.imageUrls),
        settings: JSON.parse(q.settings),
        logic: JSON.parse(q.logic || '[]'),
      })),
    };

    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    console.error('Error duplicating form:', error);
    return NextResponse.json({ error: 'Failed to duplicate form' }, { status: 500 });
  }
}
