import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeResponse } from '@/lib/api-serialization';
import { submitResponseSchema } from '@/lib/validations';
import { resolveLogicAction } from '@/lib/logic-engine';
import type { FormQuestion, LogicRule, QuestionOption, QuestionSettings } from '@/types/form';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashResponseEditToken, verifyResponseEditToken } from '@/lib/crypto';
import { enforcePublicRateLimit, publicClientId } from '@/lib/public-rate-limit';
const boundedMetadataSchema = z.record(z.unknown()).refine(
  (value) => JSON.stringify(value).length <= 20_000,
  'Metadata must not exceed 20KB'
);

// Schema for creating partial responses
const createPartialResponseSchema = z.object({
  isPartial: z.boolean().optional().default(false),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    value: z.string().max(10000),
  })).optional().default([]),
  metadata: boundedMetadataSchema.optional(),
});

// Schema for updating partial responses (PUT)
const updatePartialResponseSchema = z.object({
  responseId: z.string().min(1),
  // 32 random bytes encoded with base64url are exactly 43 characters.
  editToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid response edit token'),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    value: z.string().max(10000),
  })).optional(),
  isPartial: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  metadata: boundedMetadataSchema.optional(),
});

function answersBelongToForm(
  answers: Array<{ questionId: string }>,
  questionIds: Set<string>
): boolean {
  const seen = new Set<string>();
  return answers.every((answer) => {
    if (!questionIds.has(answer.questionId) || seen.has(answer.questionId)) return false;
    seen.add(answer.questionId);
    return true;
  });
}

type ResponseQuestionConfig = {
  id: string;
  formId?: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  order?: number;
  options: string;
  imageUrls?: string;
  settings: string;
  logic?: string;
  placeholder?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function parseQuestionSettings(question: Pick<ResponseQuestionConfig, 'settings'>): QuestionSettings {
  try {
    const parsed = JSON.parse(question.settings || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as QuestionSettings : {};
  } catch {
    return {};
  }
}

function parseQuestionArray<T>(value: string | undefined, fallback: T[] = []): T[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function toRuntimeQuestion(question: ResponseQuestionConfig): FormQuestion {
  return {
    id: question.id,
    formId: question.formId || '',
    type: question.type as FormQuestion['type'],
    title: question.title,
    description: question.description || '',
    required: question.required,
    order: question.order ?? 0,
    options: parseQuestionArray<QuestionOption>(question.options),
    imageUrls: parseQuestionArray<string>(question.imageUrls),
    settings: parseQuestionSettings(question),
    logic: parseQuestionArray<LogicRule>(question.logic),
    placeholder: question.placeholder || '',
    createdAt: question.createdAt instanceof Date ? question.createdAt.toISOString() : question.createdAt || '',
    updatedAt: question.updatedAt instanceof Date ? question.updatedAt.toISOString() : question.updatedAt || '',
  };
}

function getRequiredQuestionIdsOnSubmittedPath(
  answers: Array<{ questionId: string; value: string }>,
  questions: ResponseQuestionConfig[]
): Set<string> {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.value]));
  const answerRecord = Object.fromEntries(answerMap.entries());
  const runtimeQuestions = questions
    .map(toRuntimeQuestion)
    .filter((question) => question.type !== 'ending')
    .sort((left, right) => left.order - right.order);
  const requiredIds = new Set<string>();
  const visited = new Set<number>();
  let index = 0;

  while (index >= 0 && index < runtimeQuestions.length && !visited.has(index)) {
    visited.add(index);
    const question = runtimeQuestions[index];
    const visibility = question.settings?.visibility;
    if (visibility) {
      const controllingAnswer = answerRecord[visibility.questionId] || '';
      const visible = controllingAnswer.split(',').map((value) => value.trim()).includes(visibility.equals);
      if (!visible) {
        index += 1;
        continue;
      }
    }

    if (question.required && question.type !== 'statement') requiredIds.add(question.id);

    const answer = answerMap.get(question.id) || '';
    const action = resolveLogicAction(question, answer);
    if (action?.type === 'show_ending' || action?.targetQuestionId === '__submit__') break;
    if (action?.targetQuestionId) {
      const targetIndex = runtimeQuestions.findIndex((candidate) => candidate.id === action.targetQuestionId);
      if (targetIndex !== -1) {
        index = targetIndex;
        continue;
      }
    }
    index += 1;
  }

  return requiredIds;
}

function validateRequiredAnswers(
  answers: Array<{ questionId: string; value: string }>,
  questions: ResponseQuestionConfig[]
): string | null {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.value]));
  const requiredIds = getRequiredQuestionIdsOnSubmittedPath(answers, questions);

  for (const question of questions) {
    if (!requiredIds.has(question.id)) continue;

    const value = (answerMap.get(question.id) || '').trim();
    if (question.type === 'legal') {
      if (value !== 'true') return `Required legal consent is missing for "${question.title}"`;
      continue;
    }
    if (!value) return `Required question "${question.title}" is missing an answer`;
  }

  return null;
}

function validateAnswerValues(
  answers: Array<{ questionId: string; value: string }>,
  questions: ResponseQuestionConfig[]
): string | null {
  const questionMap = new Map(questions.map((question) => [question.id, question]));

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) return 'One or more answers do not belong to this form';
    const value = answer.value.trim();
    if (!value) continue; // Requiredness is enforced by the filler navigation.

    let settings: Record<string, unknown> = {};
    let options: Array<{ id: string }> = [];
    try {
      settings = JSON.parse(question.settings || '{}');
      const parsedOptions = JSON.parse(question.options || '[]');
      options = Array.isArray(parsedOptions)
        ? parsedOptions.flatMap((option: unknown) => {
            if (typeof option === 'string' && option.trim()) return [{ id: option }];
            if (option && typeof option === 'object' && typeof (option as { id?: unknown }).id === 'string') {
              return [{ id: (option as { id: string }).id }];
            }
            return [];
          })
        : [];
    } catch {
      return 'This form contains invalid question configuration';
    }

    if (question.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please provide a valid email address';
    if (question.type === 'phone' && !/^\+?[0-9()\s.-]{7,25}$/.test(value)) return 'Please provide a valid phone number';
    if (question.type === 'website') {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return 'Please provide a valid website URL';
      } catch { return 'Please provide a valid website URL'; }
    }
    if (question.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Please provide a valid date';
    if (['number', 'rating', 'opinion_scale'].includes(question.type)) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 'Please provide a valid number';
      const min = typeof settings.min === 'number' ? settings.min : undefined;
      const max = typeof settings.max === 'number' ? settings.max : undefined;
      if ((min !== undefined && numeric < min) || (max !== undefined && numeric > max)) return 'Answer is outside the allowed range';
    }
    if (question.type === 'legal' && value !== 'true') return 'Legal consent must be accepted';
    if (question.type === 'yes_no' && !['yes', 'no', 'true', 'false'].includes(value.toLowerCase())) return 'Please select Yes or No';
    if (['multiple_choice', 'picture_choice', 'dropdown'].includes(question.type)) {
      const selected = value.split(',').map((item) => item.trim());
      if (selected.some((optionId) => !options.some((option) => option.id === optionId))) return 'Please select a valid option';
    }
  }
  return null;
}

// GET /api/forms/[id]/responses - List responses for a form (protected)
export async function GET(
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

    // Cursor pagination protects the owner dashboard from loading an entire
    // form's response history into memory. Query values are bounded before they
    // are passed to Prisma.
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().slice(0, 200);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const cursor = searchParams.get('cursor') || undefined;
    const requestedLimit = Number(searchParams.get('limit') || '50');
    const limit = Number.isSafeInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;

    if ((startDate && Number.isNaN(Date.parse(startDate))) || (endDate && Number.isNaN(Date.parse(endDate)))) {
      return NextResponse.json({ error: 'Invalid date filter' }, { status: 400 });
    }

    // Build where clause
    const whereClause: Record<string, unknown> = { formId: id };

    // Date range filter
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      // Filter by startedAt OR completedAt falling in range
      whereClause.OR = [
        { startedAt: dateFilter },
        { completedAt: dateFilter },
      ];
    }

    if (search) {
      whereClause.answers = {
        some: {
          OR: [
            { value: { contains: search, mode: 'insensitive' } },
            { question: { title: { contains: search, mode: 'insensitive' } } },
          ],
        },
      };
    }

    const responses = await db.response.findMany({
      where: whereClause,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    const hasMore = responses.length > limit;
    const page = hasMore ? responses.slice(0, limit) : responses;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    return NextResponse.json({
      responses: page.map((response) => serializeResponse(response)),
      nextCursor,
    });
  } catch (error) {
    console.error('Error fetching responses:', error);
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
  }
}

// Helper: Calculate score for a single answer based on question settings
function calculateAnswerScore(
  questionType: string,
  answerValue: string,
  settings: {
    scoringEnabled?: boolean;
    scoreValues?: Record<string, number>;
    correctAnswer?: string;
    points?: number;
  }
): number {
  if (!settings.scoringEnabled) return 0;

  // Choice questions: scoreValues maps option ID -> score
  if (['multiple_choice', 'picture_choice', 'dropdown'].includes(questionType)) {
    const scoreValues = settings.scoreValues || {};
    // Handle multiple selections (comma-separated)
    const selectedIds = answerValue.split(',').map((s) => s.trim());
    let totalScore = 0;
    for (const id of selectedIds) {
      totalScore += scoreValues[id] || 0;
    }
    return totalScore;
  }

  // Yes/No
  if (questionType === 'yes_no') {
    const scoreValues = settings.scoreValues || {};
    const key = answerValue.toLowerCase();
    return scoreValues[key] || 0;
  }

  // Rating / Opinion Scale / Number: points per unit or correct answer
  if (['rating', 'opinion_scale', 'number'].includes(questionType)) {
    const numValue = parseFloat(answerValue);
    if (isNaN(numValue)) return 0;

    // If correctAnswer is set, award points only for correct
    if (settings.correctAnswer) {
      const correctNum = parseFloat(settings.correctAnswer);
      if (!isNaN(correctNum) && numValue === correctNum) {
        return settings.points || 0;
      }
      return 0;
    }

    // Otherwise, points per unit
    if (settings.points && settings.points > 0) {
      return numValue * settings.points;
    }
    return 0;
  }

  // Text-based questions: correct answer matching
  if (settings.correctAnswer) {
    const isCorrect = answerValue.trim().toLowerCase() === settings.correctAnswer.trim().toLowerCase();
    return isCorrect ? (settings.points || 0) : 0;
  }

  return 0;
}

// POST /api/forms/[id]/responses - Submit a new response (PUBLIC — no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const limit = await enforcePublicRateLimit({
      scope: 'response-create', formId: id, clientId: publicClientId(request.headers),
      maxRequests: 30, windowSeconds: 15 * 60,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many response attempts. Please try again later.' }, {
        status: 429, headers: { 'Retry-After': String(limit.retryAfter) },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Check if this is a partial response creation
    const isPartialRequest = body.isPartial === true;

    if (isPartialRequest) {
      // Use the partial response schema
      const validation = createPartialResponseSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const data = validation.data;

      // Verify form exists
      const form = await db.form.findUnique({
        where: { id },
        include: { questions: true },
      });
      if (!form) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404 });
      }
      if (!form.published) {
        return NextResponse.json({ error: 'Form is not published' }, { status: 400 });
      }
      if (form.closeDate && new Date() > new Date(form.closeDate)) {
        return NextResponse.json({ error: 'This form is no longer accepting responses.' }, { status: 403 });
      }
      if (form.maxResponses > 0) {
        const currentResponseCount = await db.response.count({
          where: { formId: id, isPartial: false },
        });
        if (currentResponseCount >= form.maxResponses) {
          return NextResponse.json(
            { error: `This form has reached its maximum response limit of ${form.maxResponses}.` },
            { status: 403 }
          );
        }
      }
      if (!answersBelongToForm(data.answers, new Set(form.questions.map((q) => q.id)))) {
        return NextResponse.json({ error: 'One or more answers do not belong to this form' }, { status: 400 });
      }
      const answerValidationError = validateAnswerValues(data.answers, form.questions);
      if (answerValidationError) return NextResponse.json({ error: answerValidationError }, { status: 400 });

      // Build a question lookup for scoring
      const questionMap = new Map<string, ResponseQuestionConfig>(form.questions.map((q) => [q.id, q]));

      // Pre-calculate scores for each answer
      const answerScores: Record<string, number> = {};
      let totalScore = 0;

      for (const answer of (data.answers || [])) {
        const question = questionMap.get(answer.questionId);
        if (question) {
          const settings = parseQuestionSettings(question);
          const score = calculateAnswerScore(question.type, answer.value, settings);
          answerScores[answer.questionId] = score;
          totalScore += score;
        }
      }

      // Return this high-entropy bearer credential exactly once; persist only its
      // one-way verifier and expire it if the draft is abandoned.
      const rawEditToken = randomBytes(32).toString('base64url');
      const editTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await db.$transaction(async (tx) => {
        const response = await tx.response.create({
          data: {
            formId: id,
            isPartial: true,
            completedAt: null,
            metadata: JSON.stringify(data.metadata || {}),
            score: totalScore,
            editTokenHash: hashResponseEditToken(rawEditToken),
            editTokenExpiresAt,
          },
        });

        if (data.answers && data.answers.length > 0) {
          await Promise.all(
            data.answers.map((answer) =>
              tx.answer.create({
                data: {
                  responseId: response.id,
                  questionId: answer.questionId,
                  value: answer.value,
                  score: answerScores[answer.questionId] || 0,
                },
              })
            )
          );
        }

        return tx.response.findUnique({
          where: { id: response.id },
          include: { answers: true },
        });
      });

      // Return the anonymous resume token only to the request that created it.
      // `serializeResponse` deliberately strips database credential fields.
      return NextResponse.json(
        { ...serializeResponse(result!), editToken: rawEditToken },
        { status: 201 }
      );
    }

    // Standard full response submission
    const validation = submitResponseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify form exists and is published
    const form = await db.form.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (!form.published) {
      return NextResponse.json({ error: 'Form is not published' }, { status: 400 });
    }
    if (!answersBelongToForm(data.answers, new Set(form.questions.map((q) => q.id)))) {
      return NextResponse.json({ error: 'One or more answers do not belong to this form' }, { status: 400 });
    }
    const answerValidationError = validateAnswerValues(data.answers, form.questions);
    if (answerValidationError) return NextResponse.json({ error: answerValidationError }, { status: 400 });
    const requiredValidationError = validateRequiredAnswers(data.answers, form.questions);
    if (requiredValidationError) return NextResponse.json({ error: requiredValidationError }, { status: 400 });

    // Enforce closeDate
    if (form.closeDate && new Date() > new Date(form.closeDate)) {
      return NextResponse.json(
        { error: 'This form is no longer accepting responses. The submission deadline has passed.' },
        { status: 403 }
      );
    }

    // Build a question lookup for scoring
    const questionMap = new Map<string, ResponseQuestionConfig>(form.questions.map((q) => [q.id, q]));

    // Pre-calculate scores for each answer
    const answerScores: Record<string, number> = {};
    let totalScore = 0;

    for (const answer of data.answers) {
      const question = questionMap.get(answer.questionId);
      if (question) {
        const settings = parseQuestionSettings(question);
        const score = calculateAnswerScore(question.type, answer.value, settings);
        answerScores[answer.questionId] = score;
        totalScore += score;
      }
    }

    // Wrap response + answers creation in a transaction. PostgreSQL advisory lock
    // serializes submissions for this form, so an aggregate count cannot be read
    // concurrently by two transactions that then both insert past the cap.
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const lockedForm = await tx.form.findUnique({
        where: { id },
        select: { maxResponses: true, published: true, closeDate: true },
      });
      if (!lockedForm || !lockedForm.published) {
        throw new Error('FORM_CLOSED');
      }
      if (lockedForm.closeDate && new Date() > lockedForm.closeDate) {
        throw new Error('FORM_CLOSED');
      }
      if (lockedForm.maxResponses > 0) {
        const currentResponseCount = await tx.response.count({
          where: { formId: id, isPartial: false },
        });
        if (currentResponseCount >= lockedForm.maxResponses) {
          throw new Error(`LIMIT_REACHED:${lockedForm.maxResponses}`);
        }
      }

      const response = await tx.response.create({
        data: {
          formId: id,
          completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
          isPartial: false,
          metadata: JSON.stringify(data.metadata || {}),
          score: totalScore,
        },
      });

      await Promise.all(
        data.answers.map((answer) =>
          tx.answer.create({
            data: {
              responseId: response.id,
              questionId: answer.questionId,
              value: answer.value,
              score: answerScores[answer.questionId] || 0,
            },
          })
        )
      );

      return tx.response.findUnique({
        where: { id: response.id },
        include: { answers: true },
      });
    });

    return NextResponse.json(
      serializeResponse(result!),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'FORM_CLOSED') {
      return NextResponse.json({ error: 'This form is no longer accepting responses.' }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith('LIMIT_REACHED:')) {
      const limit = error.message.split(':')[1];
      return NextResponse.json(
        { error: `This form has reached its maximum response limit of ${limit}.` },
        { status: 403 }
      );
    }
    console.error('Error creating response:', error);
    return NextResponse.json({ error: 'Failed to create response' }, { status: 500 });
  }
}

// PUT /api/forms/[id]/responses - Update a partial response (PUBLIC)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const limit = await enforcePublicRateLimit({
      scope: 'response-update', formId: id, clientId: publicClientId(request.headers),
      maxRequests: 120, windowSeconds: 15 * 60,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many draft-save attempts. Please try again later.' }, {
        status: 429, headers: { 'Retry-After': String(limit.retryAfter) },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updatePartialResponseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify the response exists and belongs to this form
    const existingResponse = await db.response.findUnique({
      where: { id: data.responseId },
    });
    if (!existingResponse || existingResponse.formId !== id || !existingResponse.isPartial) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }
    const tokenExpired = !existingResponse.editTokenExpiresAt || existingResponse.editTokenExpiresAt <= new Date();
    if (!existingResponse.editTokenHash || tokenExpired || !verifyResponseEditToken(data.editToken, existingResponse.editTokenHash)) {
      // Do not reveal whether the response ID exists to an unauthorised caller.
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    const formForUpdate = await db.form.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!formForUpdate || !formForUpdate.published) {
      return NextResponse.json({ error: 'Form is not accepting responses' }, { status: 400 });
    }
    if (data.answers && !answersBelongToForm(data.answers, new Set(formForUpdate.questions.map((q) => q.id)))) {
      return NextResponse.json({ error: 'One or more answers do not belong to this form' }, { status: 400 });
    }
    if (data.answers) {
      const answerValidationError = validateAnswerValues(data.answers, formForUpdate.questions);
      if (answerValidationError) return NextResponse.json({ error: answerValidationError }, { status: 400 });
    }
    if (data.isPartial === false) {
      const existingAnswers = await db.answer.findMany({
        where: { responseId: data.responseId },
        select: { questionId: true, value: true },
      });
      const mergedAnswers = new Map<string, string>(existingAnswers.map((answer) => [answer.questionId, answer.value]));
      for (const answer of data.answers || []) mergedAnswers.set(answer.questionId, answer.value);
      const requiredValidationError = validateRequiredAnswers(
        [...mergedAnswers.entries()].map(([questionId, value]) => ({ questionId, value })),
        formForUpdate.questions
      );
      if (requiredValidationError) return NextResponse.json({ error: requiredValidationError }, { status: 400 });
    }

    // Update the response
    const result = await db.$transaction(async (tx) => {
      // Re-check inside the write transaction so concurrent completion requests
      // cannot both mutate a draft after its bearer token has been revoked.
      const lockedResponse = await tx.response.findUnique({
        where: { id: data.responseId },
        select: { isPartial: true, editTokenHash: true, editTokenExpiresAt: true },
      });
      if (!lockedResponse || !lockedResponse.isPartial || !lockedResponse.editTokenHash ||
        !lockedResponse.editTokenExpiresAt || lockedResponse.editTokenExpiresAt <= new Date() ||
        !verifyResponseEditToken(data.editToken, lockedResponse.editTokenHash)) {
        throw new Error('DRAFT_UNAVAILABLE');
      }

      if (data.isPartial === false) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const lockedForm = await tx.form.findUnique({
          where: { id },
          select: { maxResponses: true, published: true, closeDate: true },
        });
        if (!lockedForm || !lockedForm.published) {
          throw new Error('FORM_CLOSED');
        }
        if (lockedForm.closeDate && new Date() > lockedForm.closeDate) {
          throw new Error('FORM_CLOSED');
        }
        if (lockedForm.maxResponses > 0) {
          const currentResponseCount = await tx.response.count({
            where: { formId: id, isPartial: false },
          });
          if (currentResponseCount >= lockedForm.maxResponses) {
            throw new Error(`LIMIT_REACHED:${lockedForm.maxResponses}`);
          }
        }
      }

      // Update answers (upsert)
      if (data.answers && data.answers.length > 0) {
        // Get form questions for scoring
        const form = await db.form.findUnique({
          where: { id },
          include: { questions: true },
        });
        const questionMap = new Map<string, ResponseQuestionConfig>((form?.questions || []).map((q) => [q.id, q]));

        let totalScore = 0;

        for (const answer of data.answers) {
          const question = questionMap.get(answer.questionId);
          let answerScore = 0;
          if (question) {
            const settings = parseQuestionSettings(question);
            answerScore = calculateAnswerScore(question.type, answer.value, settings);
          }
          totalScore += answerScore;

          // The compound unique constraint makes this atomic across concurrent saves.
          await tx.answer.upsert({
            where: {
              responseId_questionId: {
                responseId: data.responseId,
                questionId: answer.questionId,
              },
            },
            update: { value: answer.value, score: answerScore },
            create: {
              responseId: data.responseId,
              questionId: answer.questionId,
              value: answer.value,
              score: answerScore,
            },
          });
        }

        // Recalculate total score from all answers
        const allAnswers = await tx.answer.findMany({
          where: { responseId: data.responseId },
        });
        const recalculatedScore = allAnswers.reduce((sum, a) => sum + a.score, 0);

        // Update response
        await tx.response.update({
          where: { id: data.responseId },
          data: {
            isPartial: data.isPartial !== undefined ? data.isPartial : existingResponse.isPartial,
            completedAt: data.completedAt !== undefined
              ? (data.completedAt ? new Date(data.completedAt) : null)
              : (data.isPartial === false ? new Date() : existingResponse.completedAt),
            metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
            ...(data.isPartial === false && { editTokenHash: null, editTokenExpiresAt: null }),
            score: recalculatedScore,
          },
        });
      } else {
        // No answers to update, just update response fields
        await tx.response.update({
          where: { id: data.responseId },
          data: {
            isPartial: data.isPartial !== undefined ? data.isPartial : existingResponse.isPartial,
            completedAt: data.completedAt !== undefined
              ? (data.completedAt ? new Date(data.completedAt) : null)
              : (data.isPartial === false ? new Date() : existingResponse.completedAt),
            metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
            ...(data.isPartial === false && { editTokenHash: null, editTokenExpiresAt: null }),
          },
        });
      }

      return tx.response.findUnique({
        where: { id: data.responseId },
        include: { answers: { include: { question: true } } },
      });
    });

    return NextResponse.json(serializeResponse(result!));
  } catch (error) {
    if (error instanceof Error && error.message === 'DRAFT_UNAVAILABLE') {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'FORM_CLOSED') {
      return NextResponse.json({ error: 'This form is no longer accepting responses.' }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith('LIMIT_REACHED:')) {
      const limit = error.message.split(':')[1];
      return NextResponse.json(
        { error: `This form has reached its maximum response limit of ${limit}.` },
        { status: 403 }
      );
    }
    console.error('Error updating response:', error);
    return NextResponse.json({ error: 'Failed to update response' }, { status: 500 });
  }
}

// DELETE /api/forms/[id]/responses - Delete all responses for a form (protected)
export async function DELETE(
  _request: NextRequest,
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

    // Delete all answers first (cascade), then responses
    const responses = await db.response.findMany({
      where: { formId: id },
      select: { id: true },
    });

    const responseIds = responses.map((r) => r.id);

    if (responseIds.length > 0) {
      await db.answer.deleteMany({
        where: { responseId: { in: responseIds } },
      });

      await db.response.deleteMany({
        where: { formId: id },
      });
    }

    return NextResponse.json({
      success: true,
      deletedCount: responseIds.length,
    });
  } catch (error) {
    console.error('Error deleting responses:', error);
    return NextResponse.json({ error: 'Failed to delete responses' }, { status: 500 });
  }
}
