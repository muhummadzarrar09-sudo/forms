import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeResponse } from '@/lib/api-serialization';
import { submitResponseSchema } from '@/lib/validations';
import { z } from 'zod';

// Schema for creating partial responses
const createPartialResponseSchema = z.object({
  isPartial: z.boolean().optional().default(false),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    value: z.string().max(10000),
  })).optional().default([]),
  metadata: z.record(z.unknown()).optional(),
});

// Schema for updating partial responses (PUT)
const updatePartialResponseSchema = z.object({
  responseId: z.string().min(1),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    value: z.string().max(10000),
  })).optional(),
  isPartial: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

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

    // Parse query parameters for search and date filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

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

    const responses = await db.response.findMany({
      where: whereClause,
      orderBy: { startedAt: 'desc' },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    let serialized = responses.map((r) => serializeResponse(r));

    // Server-side search: filter by answer content
    if (search.trim()) {
      const query = search.toLowerCase();
      serialized = serialized.filter((r) =>
        r.answers.some(
          (a) =>
            a.value.toLowerCase().includes(query) ||
            (a.question?.title?.toLowerCase() || '').includes(query)
        )
      );
    }

    return NextResponse.json(serialized);
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

      // Build a question lookup for scoring
      const questionMap = new Map(form.questions.map((q) => [q.id, q]));

      // Pre-calculate scores for each answer
      const answerScores: Record<string, number> = {};
      let totalScore = 0;

      for (const answer of (data.answers || [])) {
        const question = questionMap.get(answer.questionId);
        if (question) {
          const settings = JSON.parse(question.settings || '{}');
          const score = calculateAnswerScore(question.type, answer.value, settings);
          answerScores[answer.questionId] = score;
          totalScore += score;
        }
      }

      // Create partial response
      const result = await db.$transaction(async (tx) => {
        const response = await tx.response.create({
          data: {
            formId: id,
            isPartial: true,
            completedAt: null,
            metadata: JSON.stringify(data.metadata || {}),
            score: totalScore,
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

      return NextResponse.json(
        serializeResponse(result!),
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

    // Enforce closeDate
    if (form.closeDate && new Date() > new Date(form.closeDate)) {
      return NextResponse.json(
        { error: 'This form is no longer accepting responses. The submission deadline has passed.' },
        { status: 403 }
      );
    }

    // Build a question lookup for scoring
    const questionMap = new Map(form.questions.map((q) => [q.id, q]));

    // Pre-calculate scores for each answer
    const answerScores: Record<string, number> = {};
    let totalScore = 0;

    for (const answer of data.answers) {
      const question = questionMap.get(answer.questionId);
      if (question) {
        const settings = JSON.parse(question.settings || '{}');
        const score = calculateAnswerScore(question.type, answer.value, settings);
        answerScores[answer.questionId] = score;
        totalScore += score;
      }
    }

    // Wrap response + answers creation in a transaction
    const result = await db.$transaction(async (tx) => {
      // Enforce maxResponses atomically inside the transaction
      if (form.maxResponses > 0) {
        const currentResponseCount = await tx.response.count({
          where: { formId: id },
        });
        if (currentResponseCount >= form.maxResponses) {
          throw new Error(`LIMIT_REACHED:${form.maxResponses}`);
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
    if (!existingResponse || existingResponse.formId !== id) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    // Update the response
    const result = await db.$transaction(async (tx) => {
      // Update answers (upsert)
      if (data.answers && data.answers.length > 0) {
        // Get form questions for scoring
        const form = await db.form.findUnique({
          where: { id },
          include: { questions: true },
        });
        const questionMap = new Map((form?.questions || []).map((q) => [q.id, q]));

        let totalScore = 0;

        for (const answer of data.answers) {
          const question = questionMap.get(answer.questionId);
          let answerScore = 0;
          if (question) {
            const settings = JSON.parse(question.settings || '{}');
            answerScore = calculateAnswerScore(question.type, answer.value, settings);
          }
          totalScore += answerScore;

          // Check if answer exists for this question
          const existingAnswer = await tx.answer.findFirst({
            where: {
              responseId: data.responseId,
              questionId: answer.questionId,
            },
          });

          if (existingAnswer) {
            await tx.answer.update({
              where: { id: existingAnswer.id },
              data: { value: answer.value, score: answerScore },
            });
          } else {
            await tx.answer.create({
              data: {
                responseId: data.responseId,
                questionId: answer.questionId,
                value: answer.value,
                score: answerScore,
              },
            });
          }
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
