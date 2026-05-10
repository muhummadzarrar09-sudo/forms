import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serializeQuestion } from '@/lib/api-serialization';
import { saveQuestionsSchema } from '@/lib/validations';

// PUT /api/forms/[id]/questions - Batch update/replace questions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = saveQuestionsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const questions = validation.data.questions;

    // Delete existing questions and recreate
    await db.question.deleteMany({ where: { formId: id } });

    const created = await Promise.all(
      questions.map((q, index) =>
        db.question.create({
          data: {
            formId: id,
            type: q.type,
            title: q.title,
            description: q.description ?? '',
            required: q.required ?? false,
            order: index,
            options: JSON.stringify(q.options ?? []),
            imageUrls: JSON.stringify(q.imageUrls ?? []),
            settings: JSON.stringify(q.settings ?? {}),
            logic: JSON.stringify(q.logic ?? []),
            placeholder: q.placeholder ?? '',
          },
        })
      )
    );

    const serialized = created.map((q) => serializeQuestion(q));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error updating questions:', error);
    return NextResponse.json({ error: 'Failed to update questions' }, { status: 500 });
  }
}
