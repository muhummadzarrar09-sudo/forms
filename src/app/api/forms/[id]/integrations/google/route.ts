import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { googleAccessToken } from '@/lib/google-sheets';

const destinationSchema = z.object({ spreadsheetId: z.string().min(10).max(200), sheetName: z.string().min(1).max(100), active: z.boolean().optional() }).strict();

async function owner(formId: string, userId: string) {
  return db.form.findFirst({ where: { id: formId, userId }, select: { id: true } });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions); const { id } = await params;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await owner(id, session.user.id)) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  const destination = await db.googleSheetDestination.findUnique({ where: { formId: id }, select: { spreadsheetId: true, sheetName: true, active: true, lastSyncedAt: true, lastError: true } });
  const connected = Boolean(await db.googleConnection.findUnique({ where: { userId: session.user.id }, select: { id: true } }));
  return NextResponse.json({ connected, destination });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions); const { id } = await params;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await owner(id, session.user.id)) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    const parsed = destinationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    const connection = await db.googleConnection.findUnique({ where: { userId: session.user.id } });
    if (!connection) return NextResponse.json({ error: 'Connect Google first' }, { status: 400 });
    const accessToken = await googleAccessToken(connection.id);
    const check = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(parsed.data.spreadsheetId)}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const sheet = await check.json() as { sheets?: { properties?: { title?: string } }[] };
    if (!check.ok || !sheet.sheets?.some((item) => item.properties?.title === parsed.data.sheetName)) return NextResponse.json({ error: 'Spreadsheet or worksheet is not accessible' }, { status: 400 });
    const destination = await db.googleSheetDestination.upsert({ where: { formId: id }, create: { formId: id, connectionId: connection.id, ...parsed.data }, update: { connectionId: connection.id, ...parsed.data, lastError: '' } });
    return NextResponse.json(destination);
  } catch (error) { console.error('Google destination update failed:', error); return NextResponse.json({ error: 'Could not save Google Sheets destination' }, { status: 500 }); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions); const { id } = await params;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await owner(id, session.user.id)) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  await db.googleSheetDestination.deleteMany({ where: { formId: id } });
  return NextResponse.json({ success: true });
}
