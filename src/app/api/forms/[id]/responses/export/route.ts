import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

const PAGE_SIZE = 500;

function csv(value: string): string {
  // Spreadsheet applications evaluate leading formula markers on CSV import.
  // Prefix untrusted values before escaping to prevent formula injection.
  const safeValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safeValue) ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
}

/** Streams the complete owner-authorized export without loading all responses in memory. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { id } = await params;
  const form = await db.form.findUnique({
    where: { id },
    select: { userId: true, questions: { orderBy: { order: 'asc' }, select: { id: true, title: true } } },
  });
  if (!form) return new Response(JSON.stringify({ error: 'Form not found' }), { status: 404 });
  if (form.userId !== session.user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\uFEFF${['Response ID', 'Submitted At', 'Time Taken (seconds)', ...form.questions.map((question) => question.title)].map(csv).join(',')}\n`));
        let cursor: string | undefined;
        while (true) {
          const responses = await db.response.findMany({
            where: { formId: id },
            orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take: PAGE_SIZE,
            include: { answers: { select: { questionId: true, value: true } } },
          });
          if (!responses.length) break;
          for (const response of responses) {
            const answers = new Map(response.answers.map((answer) => [answer.questionId, answer.value]));
            const seconds = response.completedAt
              ? Math.max(0, Math.round((response.completedAt.getTime() - response.startedAt.getTime()) / 1000)).toString()
              : '';
            const row = [
              response.id,
              response.completedAt?.toISOString() || response.startedAt.toISOString(),
              seconds,
              ...form.questions.map((question) => answers.get(question.id) || ''),
            ];
            controller.enqueue(encoder.encode(`${row.map(csv).join(',')}\n`));
          }
          if (responses.length < PAGE_SIZE) break;
          cursor = responses[responses.length - 1].id;
        }
        controller.close();
      } catch (error) {
        console.error('Response CSV export failed:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="form-responses.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
