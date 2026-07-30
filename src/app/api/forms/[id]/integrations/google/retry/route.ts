import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

const schema = z.object({ eventId: z.string().max(100).optional(), all: z.boolean().optional() }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions); const { id } = await params;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const destination = await db.googleSheetDestination.findFirst({ where: { formId: id, form: { userId: session.user.id } }, select: { id: true } });
  if (!destination) return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
  const where = parsed.data.all ? { destinationId: destination.id, status: 'failed' } : { id: parsed.data.eventId, destinationId: destination.id, status: 'failed' };
  const result = await db.googleSheetSyncEvent.updateMany({ where, data: { status: 'pending', attempts: 0, lastError: '' } });
  return NextResponse.json({ retried: result.count });
}
