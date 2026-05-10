import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeQuestion } from '@/lib/api-serialization';
import { saveQuestionsSchema } from '@/lib/validations';

// PUT /api/forms/[id]/questions - Batch update/replace questions
// Protected: only the form owner can update questions
// Uses upsert strategy instead of delete+recreate to preserve
// existing answers linked to questions via foreign key.
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

    const validation = saveQuestionsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const incomingQuestions = validation.data.questions;

    // Fetch existing questions for this form
    const existingQuestions = await db.question.findMany({
      where: { formId: id },
      select: { id: true },
    });
    const existingIds = new Set(existingQuestions.map((q) => q.id));

    // Separate incoming questions into those with real (existing) IDs and those that are new
    const toUpdate: typeof incomingQuestions = [];
    const toCreate: typeof incomingQuestions = [];
    const incomingIds = new Set<string>();

    for (const q of incomingQuestions) {
      const qId = q.id;
      if (qId && existingIds.has(qId)) {
        // This question already exists — update it
        toUpdate.push(q);
        incomingIds.add(qId);
      } else {
        // This is a new question — create it
        toCreate.push(q);
      }
    }

    // Questions that exist in DB but are NOT in the incoming payload should be deleted
    const toDelete = existingQuestions
      .filter((q) => !incomingIds.has(q.id))
      .map((q) => q.id);

    // Perform all operations in a transaction for atomicity
    const result = await db.$transaction(async (tx) => {
      // 1. Delete removed questions (cascade deletes their answers)
      if (toDelete.length > 0) {
        await tx.question.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // 2. Update existing questions
      const updated = await Promise.all(
        toUpdate.map((q, index) =>
          tx.question.update({
            where: { id: q.id! },
            data: {
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

      // 3. Create new questions
      const created = await Promise.all(
        toCreate.map((q, index) =>
          tx.question.create({
            data: {
              formId: id,
              type: q.type,
              title: q.title,
              description: q.description ?? '',
              required: q.required ?? false,
              order: toUpdate.length + index,
              options: JSON.stringify(q.options ?? []),
              imageUrls: JSON.stringify(q.imageUrls ?? []),
              settings: JSON.stringify(q.settings ?? {}),
              logic: JSON.stringify(q.logic ?? []),
              placeholder: q.placeholder ?? '',
            },
          })
        )
      );

      // Combine and sort by order, then re-index order values
      const allQuestions = [...updated, ...created].sort((a, b) => a.order - b.order);

      // Re-index order to be sequential (0, 1, 2, ...)
      for (let i = 0; i < allQuestions.length; i++) {
        if (allQuestions[i].order !== i) {
          await tx.question.update({
            where: { id: allQuestions[i].id },
            data: { order: i },
          });
          allQuestions[i] = { ...allQuestions[i], order: i };
        }
      }

      return allQuestions;
    });

    const serialized = result.map((q) => serializeQuestion(q));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error updating questions:', error);
    return NextResponse.json({ error: 'Failed to update questions' }, { status: 500 });
  }
}
