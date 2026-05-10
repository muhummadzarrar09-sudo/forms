import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/forms/[id]/responses/[responseId] - Delete a specific response
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id, responseId } = await params;

    // Verify the response exists and belongs to the form
    const response = await db.response.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    if (response.formId !== id) {
      return NextResponse.json({ error: 'Response does not belong to this form' }, { status: 403 });
    }

    // Delete the response (cascade will delete answers)
    await db.response.delete({
      where: { id: responseId },
    });

    return NextResponse.json({ success: true, deletedId: responseId });
  } catch (error) {
    console.error('Error deleting response:', error);
    return NextResponse.json({ error: 'Failed to delete response' }, { status: 500 });
  }
}
