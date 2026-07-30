import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Lightweight readiness endpoint for the reverse proxy/orchestrator. */
export async function GET() {
  try {
    // Use $queryRawUnsafe so Supabase PgBouncer (transaction mode) does not try
    // to use prepared statements which would log "prepared statement s0 exists".
    await db.$queryRawUnsafe('SELECT 1');
    return NextResponse.json({ status: 'ok' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    // Do not expose database/provider details to unauthenticated callers.
    console.error('Health check failed:', error);
    return NextResponse.json({ status: 'unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
