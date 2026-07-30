import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeForm, serializePublicForm } from '@/lib/api-serialization';
import { updateFormSchema } from '@/lib/validations';
import { generateSlug, ensureUniqueSlug } from '@/lib/slug';
import { unauthorized, forbidden, validationError, badRequest, notFound, internalError } from '@/lib/api-errors';

// GET /api/forms/[id]
// Public for published forms (form filler), protected for drafts (owner only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const form = await db.form.findUnique({
      where: { id },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        endings: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Check if the requester has a valid session
    const session = await getServerSession(authOptions);

    if (session?.user?.id && form.userId === session.user.id) {
      // Owner — return full form, including draft/private fields.
      return NextResponse.json(serializeForm(form));
    }

    // Everyone else — including authenticated non-owners — may only read a
    // published form. This keeps legacy public links working for respondents
    // who happen to be signed into their own creator account.
    if (!form.published) {
      return session?.user?.id ? forbidden() : notFound('Form not found');
    }

    return NextResponse.json(serializePublicForm(form));
  } catch (error) {
    console.error('Error fetching form:', error);
    return internalError('Failed to fetch form');
  }
}

// PUT /api/forms/[id] - Protected: only the form owner can update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) return notFound('Form not found');
    if (existingForm.userId !== session.user.id) return forbidden();

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const validation = updateFormSchema.safeParse(body);
    if (!validation.success) return validationError(validation.error);

    const data = validation.data;

    // Workspace IDs are not globally assignable: they must belong to the form owner.
    if (data.workspaceId) {
      const workspace = await db.workspace.findFirst({
        where: { id: data.workspaceId, userId: session.user.id },
        select: { id: true },
      });
      if (!workspace) return notFound('Workspace not found');
    }

    // Handle slug: validate uniqueness if provided
    let slugValue: string | null | undefined = undefined;
    if (data.slug !== undefined) {
      if (data.slug === null || data.slug === '') {
        // Clear the slug
        slugValue = null;
      } else {
        // Validate uniqueness
        slugValue = await ensureUniqueSlug(data.slug, id);
      }
    }

    // Build endings CRUD if provided
    // We handle endings separately after the form update
    const { endings } = data as typeof data & { endings?: Array<{ id?: string; title: string; message: string; redirectUrl?: string | null; showScore?: boolean; order: number; _delete?: boolean }> };

    const updatedForm = await db.$transaction(async (tx) => {
      await tx.form.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.published !== undefined && { published: data.published }),
          ...(slugValue !== undefined && { slug: slugValue }),
          ...(data.welcomeTitle !== undefined && { welcomeTitle: data.welcomeTitle }),
          ...(data.welcomeMessage !== undefined && { welcomeMessage: data.welcomeMessage }),
          ...(data.endingTitle !== undefined && { endingTitle: data.endingTitle }),
          ...(data.endingMessage !== undefined && { endingMessage: data.endingMessage }),
          ...(data.theme !== undefined && { theme: data.theme }),
          ...(data.backgroundColor !== undefined && { backgroundColor: data.backgroundColor }),
          ...(data.textColor !== undefined && { textColor: data.textColor }),
          ...(data.buttonColor !== undefined && { buttonColor: data.buttonColor }),
          ...(data.buttonTextColor !== undefined && { buttonTextColor: data.buttonTextColor }),
          ...(data.fontFamily !== undefined && { fontFamily: data.fontFamily }),
          ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
          ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
          ...(data.progressbar !== undefined && { progressbar: data.progressbar }),
          ...(data.showQuestionNumbers !== undefined && { showQuestionNumbers: data.showQuestionNumbers }),
          ...(data.allowBackNavigation !== undefined && { allowBackNavigation: data.allowBackNavigation }),
          ...(data.favorite !== undefined && { favorite: data.favorite }),
          ...(data.archived !== undefined && { archived: data.archived }),
          ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
          ...(data.hiddenFields !== undefined && { hiddenFields: JSON.stringify(data.hiddenFields) }),
          ...(data.calculatedVariables !== undefined && { calculatedVariables: JSON.stringify(data.calculatedVariables) }),
          ...(data.workspaceId !== undefined && { workspaceId: data.workspaceId || null }),
          ...(data.maxResponses !== undefined && { maxResponses: data.maxResponses }),
          ...(data.closeDate !== undefined && { closeDate: data.closeDate ? new Date(data.closeDate) : null }),
          ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
          ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        },
      });

      if (endings && Array.isArray(endings)) {
        // The form is owned, but ending IDs are global. Scope every supplied
        // existing ID to this form before allowing an update or deletion.
        const suppliedIds = endings.flatMap((e) => e.id ? [e.id] : []);
        if (suppliedIds.length > 0) {
          const ownedEndings = await tx.formEnding.findMany({
            where: { id: { in: suppliedIds }, formId: id },
            select: { id: true },
          });
          if (ownedEndings.length !== new Set(suppliedIds).size) {
            throw new Error('ENDING_NOT_FOUND');
          }
        }

        const toDelete = endings.filter((e) => e._delete && e.id);
        for (const e of toDelete) {
          await tx.formEnding.delete({ where: { id: e.id! } });
        }

        const toUpsert = endings.filter((e) => !e._delete);
        for (const e of toUpsert) {
          if (e.id) {
            await tx.formEnding.update({
              where: { id: e.id },
              data: {
                title: e.title,
                message: e.message,
                redirectUrl: e.redirectUrl ?? null,
                showScore: e.showScore ?? false,
                order: e.order,
              },
            });
          } else {
            await tx.formEnding.create({
              data: {
                formId: id,
                title: e.title,
                message: e.message,
                redirectUrl: e.redirectUrl ?? null,
                showScore: e.showScore ?? false,
                order: e.order,
              },
            });
          }
        }
      }

      // Re-fetch with updated endings inside the same transaction
      return tx.form.findUnique({
        where: { id },
        include: {
          _count: { select: { responses: true } },
          questions: { orderBy: { order: 'asc' } },
          endings: { orderBy: { order: 'asc' } },
          workspace: true,
        },
      });
    });

    return NextResponse.json(serializeForm(updatedForm!));
  } catch (error) {
    if (error instanceof Error && error.message === 'ENDING_NOT_FOUND') return notFound('Ending not found');
    console.error('Error updating form:', error);
    return internalError('Failed to update form');
  }
}

// DELETE /api/forms/[id] - Protected: only the form owner can delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) return notFound('Form not found');
    if (existingForm.userId !== session.user.id) return forbidden();

    await db.form.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form:', error);
    return internalError('Failed to delete form');
  }
}
