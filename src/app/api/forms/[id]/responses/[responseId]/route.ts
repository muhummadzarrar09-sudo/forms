import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// DELETE /api/forms/[id]/responses/[responseId] - Protected: only form owner can delete responses
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, responseId } = await params;

    // Verify ownership of the form
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find and verify the response belongs to this form
    const response = await db.response.findUnique({
      where: { id: responseId },
    });

    if (!response || response.formId !== id) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    // Delete the response (cascade deletes answers)
    await db.response.delete({
      where: { id: responseId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting response:', error);
    return NextResponse.json({ error: 'Failed to delete response' }, { status: 500 });
  }
}
