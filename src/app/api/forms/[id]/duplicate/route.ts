import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeForm } from '@/lib/api-serialization';

// POST /api/forms/[id]/duplicate - Duplicate a form with all its questions
// Protected: only the form owner can duplicate
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find the original form with its questions and endings
    const originalForm = await db.form.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        endings: { orderBy: { order: 'asc' } },
      },
    });

    if (!originalForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (originalForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create the duplicated form (scoped to the same user)
    // Note: slug is NOT copied — duplicates get no slug by default
    const duplicatedForm = await db.form.create({
      data: {
        title: `Copy of ${originalForm.title}`,
        description: originalForm.description,
        slug: null, // Don't copy slug
        published: false, // Duplicates are always drafts
        favorite: false, // Don't copy favorite
        archived: false, // Don't copy archived
        tags: originalForm.tags, // Copy tags as-is (already JSON string)
        hiddenFields: originalForm.hiddenFields, // Copy hidden fields (already JSON string)
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
        userId: session.user.id,
        workspaceId: originalForm.workspaceId, // Copy workspace assignment
        maxResponses: originalForm.maxResponses,
        metaTitle: originalForm.metaTitle,
        metaDescription: originalForm.metaDescription,
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
        endings: {
          create: originalForm.endings.map((e) => ({
            title: e.title,
            message: e.message,
            redirectUrl: e.redirectUrl,
            showScore: e.showScore,
            order: e.order,
          })),
        },
      },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        endings: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    return NextResponse.json(serializeForm(duplicatedForm), { status: 201 });
  } catch (error) {
    console.error('Error duplicating form:', error);
    return NextResponse.json({ error: 'Failed to duplicate form' }, { status: 500 });
  }
}
