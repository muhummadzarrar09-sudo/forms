import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH - Update partial response
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id, responseId } = await params;

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const existing = await db.response.findUnique({ where: { id: responseId } });
    if (!existing || existing.formId !== id) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    // Upsert answers
    if (body.answers && Array.isArray(body.answers)) {
      for (const answer of body.answers) {
        const existingAnswer = await db.answer.findFirst({
          where: { responseId, questionId: answer.questionId },
        });
        if (existingAnswer) {
          await db.answer.update({
            where: { id: existingAnswer.id },
            data: { value: answer.value },
          });
        } else {
          await db.answer.create({
            data: {
              responseId,
              questionId: answer.questionId,
              value: answer.value,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating partial response:', error);
    return NextResponse.json({ error: 'Failed to update partial response' }, { status: 500 });
  }
}
