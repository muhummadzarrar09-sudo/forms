import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/** Disconnects the creator's Google account and cascades all its destinations/events. */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await db.googleConnection.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Google disconnect failed:', error);
    return NextResponse.json({ error: 'Could not disconnect Google account' }, { status: 500 });
  }
}
