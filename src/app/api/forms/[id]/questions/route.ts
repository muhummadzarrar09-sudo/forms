import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeQuestion } from '@/lib/api-serialization';
import { saveQuestionsSchema } from '@/lib/validations';
import { findLogicCycles } from '@/lib/logic-engine';
import type { FormQuestion } from '@/types/form';

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
    const existingForm = await db.form.findUnique({
      where: { id },
      select: { userId: true, endings: { orderBy: { order: 'asc' } } },
    });
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

    // Preserve client-generated IDs for newly created questions. This makes
    // logic targets stable during the same autosave in which a question is
    // created, rather than replacing a `temp_*` target with an unrelated DB ID.
    const questionIds = new Set(incomingQuestions.map((question) => question.id).filter((id): id is string => Boolean(id)));
    if (questionIds.size !== incomingQuestions.length) {
      return NextResponse.json({ error: 'Every question must have a stable ID before saving logic.' }, { status: 400 });
    }
    const foreignQuestion = await db.question.findFirst({
      where: { id: { in: [...questionIds] }, formId: { not: id } },
      select: { id: true },
    });
    if (foreignQuestion) {
      return NextResponse.json({ error: 'Question ID collision detected. Please reload and try again.' }, { status: 409 });
    }

    const endings = await db.formEnding.findMany({
      where: { formId: id },
      select: { id: true },
    });
    const endingIds = new Set(endings.map((ending) => ending.id));

    for (const question of incomingQuestions) {
      const targets = [
        ...(question.logic || []).map((rule) => rule.action),
        question.settings.jumpToQuestionId
          ? { type: 'jump_to' as const, targetQuestionId: question.settings.jumpToQuestionId }
          : null,
      ].filter((action): action is { type: 'jump_to' | 'show_ending'; targetQuestionId: string } => Boolean(action));

      for (const action of targets) {
        if (action.type === 'show_ending') {
          if (action.targetQuestionId !== '__default__' && !endingIds.has(action.targetQuestionId)) {
            return NextResponse.json({ error: 'Logic references an ending that does not belong to this form.' }, { status: 400 });
          }
        } else if (
          action.targetQuestionId !== '__submit__' &&
          (!questionIds.has(action.targetQuestionId) || action.targetQuestionId === question.id)
        ) {
          return NextResponse.json({ error: 'Logic must target another question in this form or submit the form.' }, { status: 400 });
        }
      }
    }

    const cycles = findLogicCycles(incomingQuestions as unknown as FormQuestion[]);
    if (cycles.length > 0) {
      return NextResponse.json({
        error: 'Logic contains a circular jump path.',
        cycles,
      }, { status: 400 });
    }

    // Build a position map from the original incoming order so that
    // updates and creates each get the correct global position regardless
    // of which array they end up in.
    const positionMap = new Map<string, number>();
    incomingQuestions.forEach((q, i) => {
      const key = q.id ?? `__new__${i}`;
      positionMap.set(key, i);
    });

    // Fetch existing questions for this form
    const existingQuestions = await db.question.findMany({
      where: { formId: id },
      select: { id: true },
    });
    const existingIds = new Set(existingQuestions.map((q) => q.id));

    // Separate incoming questions into those with real (existing) IDs and those that are new
    const toUpdate: typeof incomingQuestions = [];
    const toCreate: Array<(typeof incomingQuestions)[number] & { _positionKey: string }> = [];
    const incomingIds = new Set<string>();

    for (let i = 0; i < incomingQuestions.length; i++) {
      const q = incomingQuestions[i];
      const qId = q.id;
      if (qId && existingIds.has(qId)) {
        // This question already exists — update it
        toUpdate.push(q);
        incomingIds.add(qId);
      } else {
        // This is a new question — create it
        toCreate.push({ ...q, _positionKey: qId ?? `__new__${i}` });
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

      // 2. Update existing questions — use position from original incomingQuestions order
      const updated = await Promise.all(
        toUpdate.map((q) =>
          tx.question.update({
            where: { id: q.id! },
            data: {
              type: q.type,
              title: q.title,
              description: q.description ?? '',
              required: q.required ?? false,
              order: positionMap.get(q.id!) ?? 0,
              options: JSON.stringify(q.options ?? []),
              imageUrls: JSON.stringify(q.imageUrls ?? []),
              settings: JSON.stringify(q.settings ?? {}),
              logic: JSON.stringify(q.logic ?? []),
              placeholder: q.placeholder ?? '',
            },
          })
        )
      );

      // 3. Create new questions — use position from original incomingQuestions order
      const created = await Promise.all(
        toCreate.map((q) =>
          tx.question.create({
            data: {
              // Client-generated IDs are kept so references in saved logic are stable.
              id: q.id!,
              formId: id,
              type: q.type,
              title: q.title,
              description: q.description ?? '',
              required: q.required ?? false,
              order: positionMap.get(q._positionKey) ?? 0,
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
      // This is a safety net — if positionMap logic is correct, no updates should be needed
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
