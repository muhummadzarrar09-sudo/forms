import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { googleAccessToken } from '@/lib/google-sheets';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions); const { id } = await params;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const destination = await db.googleSheetDestination.findFirst({ where: { formId: id, form: { userId: session.user.id } } });
    if (!destination) return NextResponse.json({ error: 'Configure a Sheets destination first' }, { status: 400 });
    const token = await googleAccessToken(destination.connectionId);
    const range = `${destination.sheetName}!A1`;
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(destination.spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [["Forms connection test", new Date().toISOString()]] }), cache: 'no-store' });
    if (!response.ok) throw new Error(`Google Sheets append failed (${response.status})`);
    await db.googleSheetDestination.update({ where: { id: destination.id }, data: { lastSyncedAt: new Date(), lastError: '' } });
    return NextResponse.json({ success: true });
  } catch (error) { console.error('Google Sheets test failed:', error); return NextResponse.json({ error: 'Google Sheets test failed' }, { status: 500 }); }
}
