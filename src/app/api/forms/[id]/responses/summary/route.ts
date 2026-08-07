import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeQuestion } from '@/lib/api-serialization';

/** Maximum free-text samples exposed per summary request. Full text is available
 * through the cursor-paginated owner response endpoint, not analytics. */
const MAX_TEXT_SAMPLES = 500;

type ChoiceRow = { questionId: string; value: string; count: bigint };
type NumericRow = { questionId: string; count: bigint; average: number | string; min: number | string; max: number | string };
type DurationRow = { averageSeconds: number | string | null };

// GET /api/forms/[id]/responses/summary - Get bounded, database-aggregated analytics (protected)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const form = await db.form.findUnique({
      where: { id },
      select: {
        userId: true,
        questions: { orderBy: { order: 'asc' } },
      },
    });

    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    if (form.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const numericTypes = ['number', 'rating', 'opinion_scale'];
    const choiceTypes = ['multiple_choice', 'picture_choice', 'dropdown', 'yes_no'];
    const textTypes = ['short_text', 'long_text', 'email', 'phone', 'website'];

    // For Supabase PgBouncer compatibility we use $queryRawUnsafe with explicit $1
    // parameters. When DATABASE_URL includes ?pgbouncer=true Prisma disables
    // prepared statements, but using Unsafe with positional params is the most
    // stable path and avoids "prepared statement s0 already exists" logs.
    //
    // We run aggregations sequentially (not Promise.all of 7) to avoid holding
    // 7 connections at once when connection_limit=1. This reduces pressure on
    // Supabase's shared pool that Realtime also uses (your MigrationsFailedToRun logs).
    const totalResponses = await db.response.count({ where: { formId: id } });
    const completedResponses = await db.response.count({ where: { formId: id, completedAt: { not: null } } });
    const durations = await db.$queryRawUnsafe(
      `SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))) AS "averageSeconds"
       FROM "Response"
       WHERE "formId" = $1 AND "completedAt" IS NOT NULL`,
      id
    ) as DurationRow[];
    const choiceRows = await db.$queryRawUnsafe(
      `SELECT a."questionId", trim(selected.value) AS value, COUNT(*)::bigint AS count
       FROM "Answer" a
       INNER JOIN "Question" q ON q.id = a."questionId"
       CROSS JOIN LATERAL unnest(string_to_array(a.value, ',')) AS selected(value)
       WHERE q."formId" = $1
         AND q.type IN ('multiple_choice', 'picture_choice', 'dropdown', 'yes_no')
         AND trim(selected.value) <> ''
       GROUP BY a."questionId", trim(selected.value)`,
      id
    ) as ChoiceRow[];
    const numericRows = await db.$queryRawUnsafe(
      `SELECT a."questionId",
         COUNT(*)::bigint AS count,
         AVG(a.value::double precision) AS average,
         MIN(a.value::double precision) AS min,
         MAX(a.value::double precision) AS max
       FROM "Answer" a
       INNER JOIN "Question" q ON q.id = a."questionId"
       WHERE q."formId" = $1
         AND q.type IN ('number', 'rating', 'opinion_scale')
         AND a.value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
       GROUP BY a."questionId"`,
      id
    ) as NumericRow[];
    const textAnswers = await db.answer.findMany({
      where: { question: { formId: id, type: { in: textTypes } }, value: { not: '' } },
      select: { questionId: true, value: true },
      take: MAX_TEXT_SAMPLES,
    });
    const statusRows = await db.response.groupBy({ where: { formId: id }, by: ['status'], _count: { _all: true } });

    const choiceByQuestion = new Map<string, ChoiceRow[]>();
    for (const row of choiceRows) {
      choiceByQuestion.set(row.questionId, [...(choiceByQuestion.get(row.questionId) || []), row]);
    }
    const numericByQuestion = new Map<string, NumericRow>();
    for (const row of numericRows) {
      numericByQuestion.set(row.questionId, row);
    }
    const textByQuestion = new Map<string, string[]>();
    for (const answer of textAnswers) {
      textByQuestion.set(answer.questionId, [...(textByQuestion.get(answer.questionId) || []), answer.value]);
    }

    const questionSummaries = form.questions.map((question) => {
      const serialized = serializeQuestion(question);
      const summary: Record<string, unknown> = {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        totalAnswers: 0,
      };

      if (choiceTypes.includes(question.type)) {
        const choiceCounts: Record<string, number> = {};
        const optionLabelById = new Map<string, string>(serialized.options.map((option) => [option.id, option.label]));
        if (question.type === 'yes_no') {
          choiceCounts.Yes = 0;
          choiceCounts.No = 0;
        } else {
          for (const option of serialized.options) choiceCounts[option.label] = 0;
        }
        let total = 0;
        for (const row of choiceByQuestion.get(question.id) || []) {
          const normalized = row.value.toLowerCase();
          const label = question.type === 'yes_no'
            ? (normalized === 'yes' || normalized === 'true' ? 'Yes' : normalized === 'no' || normalized === 'false' ? 'No' : row.value)
            : (optionLabelById.get(row.value) || row.value);
          const count = Number(row.count);
          choiceCounts[label] = (choiceCounts[label] || 0) + count;
          total += count;
        }
        summary.choiceCounts = choiceCounts;
        summary.totalAnswers = total;
      }

      if (numericTypes.includes(question.type)) {
        const numeric = numericByQuestion.get(question.id);
        if (numeric) {
          summary.totalAnswers = Number(numeric.count);
          summary.average = Number(numeric.average);
          summary.min = Number(numeric.min);
          summary.max = Number(numeric.max);
        }
      }

      if (textTypes.includes(question.type)) {
        const values = textByQuestion.get(question.id) || [];
        summary.totalAnswers = values.length;
        summary.textAnswers = values;
        summary.textAnswersTruncated = textAnswers.length >= MAX_TEXT_SAMPLES;
      }

      return summary;
    });

    const statusCounts = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));

    return NextResponse.json({
      totalResponses,
      statusCounts,
      completedResponses,
      completionRate: totalResponses ? Math.round((completedResponses / totalResponses) * 100) : 0,
      averageTime: Number(durations[0]?.averageSeconds || 0),
      questionSummaries,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
