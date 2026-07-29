import { NextRequest, NextResponse } from 'next/server';
import { authorizedCronRequest } from '@/app/api/internal/cleanup/route';
import { deliverPendingGoogleSheetEvents } from '@/lib/google-sheets-delivery';

/** Cron-driven outbox worker; keeps third-party Google delivery out of respondent requests. */
export async function POST(request: NextRequest) {
  if (!authorizedCronRequest(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const result = await deliverPendingGoogleSheetEvents();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Google Sheets sync worker failed:', error);
    return NextResponse.json({ error: 'Sync worker failed' }, { status: 500 });
  }
}
