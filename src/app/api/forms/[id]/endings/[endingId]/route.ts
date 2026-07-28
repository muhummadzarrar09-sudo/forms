import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeEnding } from '@/lib/api-serialization';
import { updateEndingSchema } from '@/lib/validations';

// PUT /api/forms/[id]/endings/[endingId] - Update an ending
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; endingId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, endingId } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify ending belongs to form
    const existingEnding = await db.formEnding.findUnique({
      where: { id: endingId },
    });
    if (!existingEnding || existingEnding.formId !== id) {
      return NextResponse.json({ error: 'Ending not found' }, { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateEndingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }
    const data = validation.data;

    const ending = await db.formEnding.update({
      where: { id: endingId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.message !== undefined && { message: data.message }),
        ...(data.redirectUrl !== undefined && { redirectUrl: data.redirectUrl }),
        ...(data.showScore !== undefined && { showScore: data.showScore }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });

    return NextResponse.json(serializeEnding(ending));
  } catch (error) {
    console.error('Error updating ending:', error);
    return NextResponse.json({ error: 'Failed to update ending' }, { status: 500 });
  }
}

// DELETE /api/forms/[id]/endings/[endingId] - Delete an ending
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; endingId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, endingId } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify ending belongs to form
    const existingEnding = await db.formEnding.findUnique({
      where: { id: endingId },
    });
    if (!existingEnding || existingEnding.formId !== id) {
      return NextResponse.json({ error: 'Ending not found' }, { status: 404 });
    }

    await db.formEnding.delete({ where: { id: endingId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ending:', error);
    return NextResponse.json({ error: 'Failed to delete ending' }, { status: 500 });
  }
}
