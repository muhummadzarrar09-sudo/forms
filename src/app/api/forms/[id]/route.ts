import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeForm } from '@/lib/api-serialization';
import { updateFormSchema } from '@/lib/validations';

// GET /api/forms/[id]
// Public: accessible without auth so the form filler can load form data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const form = await db.form.findUnique({
      where: { id },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json(serializeForm(form));
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
}

// PUT /api/forms/[id] - Protected: only the form owner can update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateFormSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const form = await db.form.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.published !== undefined && { published: data.published }),
        ...(data.welcomeTitle !== undefined && { welcomeTitle: data.welcomeTitle }),
        ...(data.welcomeMessage !== undefined && { welcomeMessage: data.welcomeMessage }),
        ...(data.endingTitle !== undefined && { endingTitle: data.endingTitle }),
        ...(data.endingMessage !== undefined && { endingMessage: data.endingMessage }),
        ...(data.theme !== undefined && { theme: data.theme }),
        ...(data.backgroundColor !== undefined && { backgroundColor: data.backgroundColor }),
        ...(data.textColor !== undefined && { textColor: data.textColor }),
        ...(data.buttonColor !== undefined && { buttonColor: data.buttonColor }),
        ...(data.buttonTextColor !== undefined && { buttonTextColor: data.buttonTextColor }),
        ...(data.fontFamily !== undefined && { fontFamily: data.fontFamily }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
        ...(data.progressbar !== undefined && { progressbar: data.progressbar }),
        ...(data.showQuestionNumbers !== undefined && { showQuestionNumbers: data.showQuestionNumbers }),
        ...(data.allowBackNavigation !== undefined && { allowBackNavigation: data.allowBackNavigation }),
        ...(data.favorite !== undefined && { favorite: data.favorite }),
        ...(data.archived !== undefined && { archived: data.archived }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
        ...(data.workspaceId !== undefined && { workspaceId: data.workspaceId || null }),
        ...(data.maxResponses !== undefined && { maxResponses: data.maxResponses }),
        ...(data.closeDate !== undefined && { closeDate: data.closeDate ? new Date(data.closeDate) : null }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
      },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    return NextResponse.json(serializeForm(form));
  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
  }
}

// DELETE /api/forms/[id] - Protected: only the form owner can delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.form.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form:', error);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
}
