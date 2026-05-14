import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeEnding } from '@/lib/api-serialization';

// GET /api/forms/[id]/endings - List all endings for a form
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

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const endings = await db.formEnding.findMany({
      where: { formId: id },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(endings.map(serializeEnding));
  } catch (error) {
    console.error('Error fetching endings:', error);
    return NextResponse.json({ error: 'Failed to fetch endings' }, { status: 500 });
  }
}

// POST /api/forms/[id]/endings - Create a new ending
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Get current max order
    const maxOrderEnding = await db.formEnding.findFirst({
      where: { formId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderEnding?.order ?? -1) + 1;

    const ending = await db.formEnding.create({
      data: {
        formId: id,
        title: body.title || 'Thank you!',
        message: body.message || 'Your response has been recorded.',
        redirectUrl: body.redirectUrl || null,
        showScore: body.showScore ?? false,
        order: body.order ?? nextOrder,
      },
    });

    return NextResponse.json(serializeEnding(ending), { status: 201 });
  } catch (error) {
    console.error('Error creating ending:', error);
    return NextResponse.json({ error: 'Failed to create ending' }, { status: 500 });
  }
}
