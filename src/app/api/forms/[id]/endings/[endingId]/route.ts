import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeEnding } from '@/lib/api-serialization';

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

    const ending = await db.formEnding.update({
      where: { id: endingId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.message !== undefined && { message: body.message }),
        ...(body.redirectUrl !== undefined && { redirectUrl: body.redirectUrl || null }),
        ...(body.showScore !== undefined && { showScore: body.showScore }),
        ...(body.order !== undefined && { order: body.order }),
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
