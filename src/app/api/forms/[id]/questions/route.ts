import { NextRequest, NextResponse } from 'next/server';
import { serializeQuestion } from '@/lib/api-serialization';
import { saveQuestionsSchema } from '@/lib/validations';
import { findLogicCycles } from '@/lib/logic-engine';
import type { FormQuestion } from '@/types/form';
import { forbidden, internalError, notFound, unauthorized, validationError } from '@/lib/api-errors';
import { getSupabaseAdminClient, requireSupabaseLegacyUser } from '@/lib/supabase/server';
import { getLegacyFormById } from '@/lib/supabase/forms-data';

// PUT /api/forms/[id]/questions - Owner-only batch save.
//
// Unlike the old Prisma implementation, this refuses to delete an omitted
// question when the form has responses. That prevents a builder autosave from
// cascading away historical answers.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSupabaseLegacyUser();
    if (!user) return unauthorized();
    const { id } = await params;

    const form = await getLegacyFormById(id);
    if (!form) return notFound('Form not found');
    if (form.userId !== user.legacyUserId) return forbidden();

    const body = await request.json().catch(() => null);
    const validation = saveQuestionsSchema.safeParse(body);
    if (!validation.success) return validationError(validation.error);
    const incomingQuestions = validation.data.questions;

    const questionIds = new Set(incomingQuestions.map((question) => question.id).filter((questionId): questionId is string => Boolean(questionId)));
    if (questionIds.size !== incomingQuestions.length) {
      return NextResponse.json({ error: 'Every question must have a stable ID before saving logic.' }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    if (questionIds.size > 0) {
      const { data: foreignQuestions, error } = await admin
        .from('Question')
        .select('id')
        .in('id', [...questionIds])
        .neq('formId', id);
      if (error) throw new Error(`Unable to check question IDs: ${error.message}`);
      if ((foreignQuestions || []).length > 0) {
        return NextResponse.json({ error: 'Question ID collision detected. Please reload and try again.' }, { status: 409 });
      }
    }

    const endingIds = new Set(form.endings.map((ending) => ending.id));
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
      return NextResponse.json({ error: 'Logic contains a circular jump path.', cycles }, { status: 400 });
    }

    const existingIds = new Set(form.questions.map((question) => question.id));
    const incomingIds = new Set(incomingQuestions.map((question) => question.id!));
    const toDelete = [...existingIds].filter((questionId) => !incomingIds.has(questionId));

    if (toDelete.length > 0) {
      const { count, error } = await admin
        .from('Response')
        .select('id', { count: 'exact', head: true })
        .eq('formId', id);
      if (error) throw new Error(`Unable to check response history: ${error.message}`);
      if ((count || 0) > 0) {
        return NextResponse.json({
          error: 'Questions with historical responses cannot be removed. Keep the question or create a reviewed retention migration.',
        }, { status: 409 });
      }
    }

    // All validation and ownership checks occur before any mutation. A future
    // SQL RPC will make this sequence fully transactional for multi-user/high-
    // contention deployments; the current private project has no responses.
    for (let order = 0; order < incomingQuestions.length; order += 1) {
      const question = incomingQuestions[order];
      const payload = {
        type: question.type,
        title: question.title,
        description: question.description ?? '',
        required: question.required ?? false,
        order,
        options: JSON.stringify(question.options ?? []),
        imageUrls: JSON.stringify(question.imageUrls ?? []),
        settings: JSON.stringify(question.settings ?? {}),
        logic: JSON.stringify(question.logic ?? []),
        placeholder: question.placeholder ?? '',
      };

      if (existingIds.has(question.id!)) {
        const { error } = await admin
          .from('Question')
          .update(payload)
          .eq('id', question.id!)
          .eq('formId', id);
        if (error) throw new Error(`Unable to update question: ${error.message}`);
      } else {
        const { error } = await admin
          .from('Question')
          .insert({ id: question.id!, formId: id, ...payload });
        if (error) throw new Error(`Unable to create question: ${error.message}`);
      }
    }

    if (toDelete.length > 0) {
      const { error } = await admin.from('Question').delete().eq('formId', id).in('id', toDelete);
      if (error) throw new Error(`Unable to remove questions: ${error.message}`);
    }

    const { data: saved, error: savedError } = await admin
      .from('Question')
      .select('*')
      .eq('formId', id)
      .order('order', { ascending: true });
    if (savedError) throw new Error(`Unable to reload questions: ${savedError.message}`);

    return NextResponse.json((saved || []).map(serializeQuestion));
  } catch (error) {
    console.error('Error updating questions:', error);
    return internalError('Failed to update questions');
  }
}
