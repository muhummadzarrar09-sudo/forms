import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serializeResponse } from '@/lib/api-serialization';

// POST - Create partial response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const form = await db.form.findUnique({ where: { id }, select: { published: true } });
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const response = await db.response.create({
      data: {
        formId: id,
        completedAt: null,
        metadata: JSON.stringify(body.metadata || {}),
      },
    });

    if (body.answers && Array.isArray(body.answers)) {
      await Promise.all(
        body.answers.map((answer: { questionId: string; value: string }) =>
          db.answer.create({
            data: {
              responseId: response.id,
              questionId: answer.questionId,
              value: answer.value,
            },
          })
        )
      );
    }

    return NextResponse.json({ responseId: response.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating partial response:', error);
    return NextResponse.json({ error: 'Failed to create partial response' }, { status: 500 });
  }
}
