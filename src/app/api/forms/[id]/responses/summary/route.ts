import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeQuestion } from '@/lib/api-serialization';

// GET /api/forms/[id]/responses/summary - Get response summary/analytics (protected)
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
      include: {
        questions: { orderBy: { order: 'asc' } },
        responses: {
          include: {
            answers: { include: { question: true } },
          },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (form.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const totalResponses = form.responses.length;
    const completedResponses = form.responses.filter((r) => r.completedAt).length;
    const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;

    // Calculate average time
    const responseTimes = form.responses
      .filter((r) => r.completedAt)
      .map((r) => {
        const start = new Date(r.startedAt).getTime();
        const end = new Date(r.completedAt!).getTime();
        return (end - start) / 1000;
      });
    const averageTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Question summaries
    const questionSummaries = form.questions.map((question) => {
      // Use the shared serializer to parse options/settings safely
      const serialized = serializeQuestion(question);
      const parsedOptions = serialized.options as Array<{ id: string; label: string }>;

      const answers = form.responses.flatMap((r) =>
        r.answers.filter((a) => a.questionId === question.id)
      );

      const summary: Record<string, unknown> = {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        totalAnswers: answers.length,
      };

      // For choice questions
      if (['multiple_choice', 'picture_choice', 'dropdown', 'yes_no'].includes(question.type)) {
        const choiceCounts: Record<string, number> = {};
        const optionLabelById = new Map<string, string>();

        if (question.type === 'yes_no') {
          choiceCounts.Yes = 0;
          choiceCounts.No = 0;
        } else {
          parsedOptions.forEach((opt) => {
            optionLabelById.set(opt.id, opt.label);
            choiceCounts[opt.label] = 0;
          });
        }

        answers.forEach((a) => {
          const selectedValues = a.value.split(',').map((value) => value.trim()).filter(Boolean);
          selectedValues.forEach((selectedValue) => {
            const normalizedYesNo = selectedValue.toLowerCase();
            const label = question.type === 'yes_no'
              ? (normalizedYesNo === 'yes' || normalizedYesNo === 'true' ? 'Yes' : normalizedYesNo === 'no' || normalizedYesNo === 'false' ? 'No' : selectedValue)
              : (optionLabelById.get(selectedValue) || selectedValue);
            choiceCounts[label] = (choiceCounts[label] || 0) + 1;
          });
        });
        summary.choiceCounts = choiceCounts;
      }

      // For number/rating/scale
      if (['number', 'rating', 'opinion_scale'].includes(question.type)) {
        const numValues = answers
          .map((a) => parseFloat(a.value))
          .filter((v) => !isNaN(v));
        if (numValues.length > 0) {
          summary.average = numValues.reduce((a, b) => a + b, 0) / numValues.length;
          summary.min = Math.min(...numValues);
          summary.max = Math.max(...numValues);
        }
      }

      // For text questions
      if (['short_text', 'long_text', 'email', 'phone', 'website'].includes(question.type)) {
        summary.textAnswers = answers.map((a) => a.value).filter((v) => v.trim() !== '');
      }

      return summary;
    });

    return NextResponse.json({
      totalResponses,
      completedResponses,
      completionRate,
      averageTime,
      questionSummaries,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
