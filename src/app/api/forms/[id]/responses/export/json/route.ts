import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeResponse } from '@/lib/api-serialization';

const PAGE_SIZE = 500;

/** Streams a complete machine-readable owner export without loading all responses in memory. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions); const { id } = await params;
  if (!session?.user?.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const form = await db.form.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' } } } });
  if (!form) return new Response(JSON.stringify({ error: 'Form not found' }), { status: 404 });
  if (form.userId !== session.user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    try {
      controller.enqueue(encoder.encode(JSON.stringify({ form: { id: form.id, title: form.title, description: form.description, questions: form.questions }, responses: [] }).replace('[]}', '[')));
      let cursor: string | undefined; let first = true;
      while (true) {
        const page = await db.response.findMany({ where: { formId: id }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: PAGE_SIZE, include: { answers: { include: { question: true } } } });
        if (!page.length) break;
        for (const response of page) { controller.enqueue(encoder.encode(`${first ? '' : ','}${JSON.stringify(serializeResponse(response))}`)); first = false; }
        if (page.length < PAGE_SIZE) break; cursor = page[page.length - 1].id;
      }
      controller.enqueue(encoder.encode(']}')); controller.close();
    } catch (error) { controller.error(error); }
  }});
  return new Response(stream, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="form-responses.json"', 'Cache-Control': 'no-store' } });
}
