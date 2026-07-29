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

    const [totalResponses, completedResponses, durations, choiceRows, numericRows, textAnswers, statusRows] = await Promise.all([
      db.response.count({ where: { formId: id } }),
      db.response.count({ where: { formId: id, completedAt: { not: null } } }),
      db.$queryRaw<DurationRow[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))) AS "averageSeconds"
        FROM "Response"
        WHERE "formId" = ${id} AND "completedAt" IS NOT NULL
      `,
      db.$queryRaw<ChoiceRow[]>`
        SELECT a."questionId", trim(selected.value) AS value, COUNT(*)::bigint AS count
        FROM "Answer" a
        INNER JOIN "Question" q ON q.id = a."questionId"
        CROSS JOIN LATERAL unnest(string_to_array(a.value, ',')) AS selected(value)
        WHERE q."formId" = ${id}
          AND q.type IN ('multiple_choice', 'picture_choice', 'dropdown', 'yes_no')
          AND trim(selected.value) <> ''
        GROUP BY a."questionId", trim(selected.value)
      `,
      db.$queryRaw<NumericRow[]>`
        SELECT a."questionId",
          COUNT(*)::bigint AS count,
          AVG(a.value::double precision) AS average,
          MIN(a.value::double precision) AS min,
          MAX(a.value::double precision) AS max
        FROM "Answer" a
        INNER JOIN "Question" q ON q.id = a."questionId"
        WHERE q."formId" = ${id}
          AND q.type IN ('number', 'rating', 'opinion_scale')
          AND a.value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
        GROUP BY a."questionId"
      `,
      db.answer.findMany({
        where: { question: { formId: id, type: { in: textTypes } }, value: { not: '' } },
        select: { questionId: true, value: true },
        take: MAX_TEXT_SAMPLES,
      }),
      db.response.groupBy({ where: { formId: id }, by: ['status'], _count: { _all: true } }),
    ]);

    const choiceByQuestion = new Map<string, ChoiceRow[]>();
    for (const row of choiceRows) {
      choiceByQuestion.set(row.questionId, [...(choiceByQuestion.get(row.questionId) || []), row]);
    }
    const numericByQuestion = new Map(numericRows.map((row) => [row.questionId, row]));
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
        const optionLabelById = new Map(serialized.options.map((option) => [option.id, option.label]));
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
