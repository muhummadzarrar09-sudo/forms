import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeForm } from '@/lib/api-serialization';
import { createFormSchema } from '@/lib/validations';
import { generateSlug, ensureUniqueSlug } from '@/lib/slug';
import { unauthorized, forbidden, validationError, badRequest, notFound, internalError } from '@/lib/api-errors';

// GET /api/forms - List all forms for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    const forms = await db.form.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        endings: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    const serialized = forms.map((form) => serializeForm(form));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return internalError('Failed to fetch forms');
  }
}

// POST /api/forms - Create a new form
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const validation = createFormSchema.safeParse(body);
    if (!validation.success) return validationError(validation.error);

    const data = validation.data;

    // A workspace is part of a user's private namespace. Never attach a form
    // to a workspace merely because its opaque ID was supplied by the client.
    if (data.workspaceId) {
      const workspace = await db.workspace.findFirst({
        where: { id: data.workspaceId, userId: session.user.id },
        select: { id: true },
      });
      if (!workspace) return notFound('Workspace not found');
    }

    // Auto-generate slug from title if not provided
    let slug: string | null = null;
    if (data.slug !== undefined) {
      // Explicit slug provided (could be null to clear)
      if (data.slug) {
        slug = await ensureUniqueSlug(data.slug);
      }
    } else {
      // No slug provided — auto-generate from title
      const baseSlug = generateSlug(data.title || 'untitled-form');
      if (baseSlug) {
        slug = await ensureUniqueSlug(baseSlug);
      }
    }

    const form = await db.form.create({
      data: {
        title: data.title ?? 'Untitled Form',
        description: data.description ?? '',
        slug,
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
        hiddenFields: JSON.stringify(data.hiddenFields ?? []),
        calculatedVariables: JSON.stringify(data.calculatedVariables ?? []),
        userId: session.user.id,
        ...(data.workspaceId && { workspaceId: data.workspaceId }),
      },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        endings: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    return NextResponse.json(serializeForm(form), { status: 201 });
  } catch (error) {
    console.error('Error creating form:', error);
    return internalError('Failed to create form');
  }
}
