import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeForm } from '@/lib/api-serialization';
import { createFormSchema } from '@/lib/validations';

// GET /api/forms - List all forms for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const forms = await db.form.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    const serialized = forms.map((form) => serializeForm(form));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
}

// POST /api/forms - Create a new form
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createFormSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const form = await db.form.create({
      data: {
        title: data.title,
        description: data.description,
        welcomeTitle: data.welcomeTitle ?? 'Welcome!',
        welcomeMessage: data.welcomeMessage ?? 'Thanks for taking the time to fill this out.',
        endingTitle: data.endingTitle ?? 'Thank you!',
        endingMessage: data.endingMessage ?? 'Your response has been recorded.',
        theme: data.theme ?? 'default',
        backgroundColor: data.backgroundColor ?? '#FFFFFF',
        textColor: data.textColor ?? '#333333',
        buttonColor: data.buttonColor ?? '#1A1A1A',
        buttonTextColor: data.buttonTextColor ?? '#FFFFFF',
        fontFamily: data.fontFamily ?? 'sans',
        progressbar: data.progressbar ?? true,
        showQuestionNumbers: data.showQuestionNumbers ?? true,
        allowBackNavigation: data.allowBackNavigation ?? true,
        userId: session.user.id,
        ...(data.workspaceId && { workspaceId: data.workspaceId }),
      },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    return NextResponse.json(serializeForm(form), { status: 201 });
  } catch (error) {
    console.error('Error creating form:', error);
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
  }
}
