import { NextRequest, NextResponse } from 'next/server';
import { serializeForm, serializePublicForm } from '@/lib/api-serialization';
import { updateFormSchema } from '@/lib/validations';
import { generateSlug, ensureUniqueSlug } from '@/lib/slug';
import { unauthorized, forbidden, validationError, badRequest, notFound, internalError } from '@/lib/api-errors';
import { ensureAccessibleFormTheme } from '@/lib/form-theme';
import { createRecordId } from '@/lib/ids';
import { getSupabaseAdminClient, requireSupabaseLegacyUser } from '@/lib/supabase/server';
import { getLegacyFormById } from '@/lib/supabase/forms-data';

type EndingInput = {
  id?: string;
  title: string;
  message: string;
  redirectUrl?: string | null;
  showScore?: boolean;
  order: number;
  _delete?: boolean;
};

// GET /api/forms/[id]
// Published, non-archived forms are served through a deliberately restricted
// public DTO. Owners receive the full builder DTO after Supabase Auth + bridge
// verification; no client-supplied user ID participates in the decision.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const form = await getLegacyFormById(id);
    if (!form) return notFound('Form not found');

    const user = await requireSupabaseLegacyUser();
    if (user?.legacyUserId === form.userId) {
      return NextResponse.json(serializeForm(form));
    }

    if (!form.published || form.archived) {
      return user ? forbidden() : notFound('Form not found');
    }

    return NextResponse.json(serializePublicForm(form));
  } catch (error) {
    console.error('Error fetching form:', error);
    return internalError('Failed to fetch form');
  }
}

// PUT /api/forms/[id] - Owner-only update through the trusted server layer.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSupabaseLegacyUser();
    if (!user) return unauthorized();
    const { id } = await params;

    const existing = await getLegacyFormById(id);
    if (!existing) return notFound('Form not found');
    if (existing.userId !== user.legacyUserId) return forbidden();

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');
    const validation = updateFormSchema.safeParse(body);
    if (!validation.success) return validationError(validation.error);
    const data = validation.data;
    const admin = getSupabaseAdminClient();

    if (data.workspaceId) {
      const { data: workspace, error } = await admin
        .from('Workspace')
        .select('id')
        .eq('id', data.workspaceId)
        .eq('userId', user.legacyUserId)
        .maybeSingle();
      if (error) throw new Error(`Unable to check workspace ownership: ${error.message}`);
      if (!workspace) return notFound('Workspace not found');
    }

    const paletteWasUpdated = data.backgroundColor !== undefined || data.textColor !== undefined ||
      data.buttonColor !== undefined || data.buttonTextColor !== undefined;
    const accessiblePalette = paletteWasUpdated
      ? ensureAccessibleFormTheme({
          backgroundColor: data.backgroundColor ?? existing.backgroundColor,
          textColor: data.textColor ?? existing.textColor,
          buttonColor: data.buttonColor ?? existing.buttonColor,
          buttonTextColor: data.buttonTextColor ?? existing.buttonTextColor,
          fontFamily: data.fontFamily ?? existing.fontFamily,
        })
      : null;

    let slugValue: string | null | undefined;
    if (data.slug !== undefined) {
      slugValue = data.slug ? await ensureUniqueSlug(data.slug, id) : null;
    }

    const endings = (data as typeof data & { endings?: EndingInput[] }).endings;
    const updateData: Record<string, unknown> = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.published !== undefined && { published: data.published }),
      ...(slugValue !== undefined && { slug: slugValue }),
      ...(data.welcomeTitle !== undefined && { welcomeTitle: data.welcomeTitle }),
      ...(data.welcomeMessage !== undefined && { welcomeMessage: data.welcomeMessage }),
      ...(data.endingTitle !== undefined && { endingTitle: data.endingTitle }),
      ...(data.endingMessage !== undefined && { endingMessage: data.endingMessage }),
      ...(data.theme !== undefined && { theme: data.theme }),
      ...(accessiblePalette && { backgroundColor: accessiblePalette.backgroundColor }),
      ...(accessiblePalette && { textColor: accessiblePalette.textColor }),
      ...(accessiblePalette && { buttonColor: accessiblePalette.buttonColor }),
      ...(accessiblePalette && { buttonTextColor: accessiblePalette.buttonTextColor }),
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
      ...(data.workspaceId !== undefined && { workspaceId: data.workspaceId }),
      ...(data.maxResponses !== undefined && { maxResponses: data.maxResponses }),
      ...(data.closeDate !== undefined && { closeDate: data.closeDate }),
      ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
      ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
    };

    const { data: updated, error: updateError } = await admin
      .from('Form')
      .update(updateData)
      .eq('id', id)
      .eq('userId', user.legacyUserId)
      .select('*')
      .maybeSingle();
    if (updateError) {
      if ((updateError as { code?: string }).code === '23505') return badRequest('That share URL is already in use.');
      throw new Error(`Unable to update form: ${updateError.message}`);
    }
    if (!updated) return notFound('Form not found');

    if (Array.isArray(endings)) {
      await replaceOwnedEndings({ formId: id, ownerId: user.legacyUserId, endings });
    }

    // Reload after every related write so the client receives the canonical
    // timestamps/counts/ordering from the database rather than optimistic data.
    const reloaded = await getLegacyFormById(id);
    if (!reloaded) return notFound('Form not found');
    return NextResponse.json(serializeForm(reloaded));
  } catch (error) {
    if (error instanceof Error && error.message === 'ENDING_NOT_FOUND') return notFound('Ending not found');
    console.error('Error updating form:', error);
    return internalError('Failed to update form');
  }
}

// DELETE /api/forms/[id] - Scope delete to the verified owner in the query.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSupabaseLegacyUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from('Form')
      .delete()
      .eq('id', id)
      .eq('userId', user.legacyUserId)
      .select('id');
    if (error) throw new Error(`Unable to delete form: ${error.message}`);
    if (!data || data.length !== 1) return notFound('Form not found');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form:', error);
    return internalError('Failed to delete form');
  }
}

/**
 * Endings are small form-owned configuration rows. Validate ownership before
 * mutation and scope every mutation to the parent form. A database RPC will
 * replace this sequence before multi-user/high-contention rollout; current
 * personal-project data has no endings and this preserves legacy behaviour.
 */
async function replaceOwnedEndings({ formId, ownerId, endings }: {
  formId: string;
  ownerId: string;
  endings: EndingInput[];
}) {
  const admin = getSupabaseAdminClient();

  const suppliedIds = [...new Set(endings.flatMap((ending) => ending.id ? [ending.id] : []))];
  if (suppliedIds.length > 0) {
    const { data: owned, error } = await admin
      .from('FormEnding')
      .select('id,formId')
      .eq('formId', formId)
      .in('id', suppliedIds);
    if (error) throw new Error(`Unable to verify form endings: ${error.message}`);
    if ((owned || []).length !== suppliedIds.length) throw new Error('ENDING_NOT_FOUND');
  }

  // Reconfirm the parent still belongs to the authenticated owner before every
  // related write sequence. This prevents an ownership race from targeting a
  // global ending ID after a form transfer/deletion.
  const { data: parent, error: parentError } = await admin
    .from('Form')
    .select('id')
    .eq('id', formId)
    .eq('userId', ownerId)
    .maybeSingle();
  if (parentError) throw new Error(`Unable to verify form ownership: ${parentError.message}`);
  if (!parent) throw new Error('ENDING_NOT_FOUND');

  for (const ending of endings.filter((item) => item._delete && item.id)) {
    const { error } = await admin.from('FormEnding').delete().eq('id', ending.id!).eq('formId', formId);
    if (error) throw new Error(`Unable to delete ending: ${error.message}`);
  }

  for (const ending of endings.filter((item) => !item._delete)) {
    const payload = {
      title: ending.title,
      message: ending.message,
      redirectUrl: ending.redirectUrl ?? null,
      showScore: ending.showScore ?? false,
      order: ending.order,
    };
    if (ending.id) {
      const { error } = await admin.from('FormEnding').update(payload).eq('id', ending.id).eq('formId', formId);
      if (error) throw new Error(`Unable to update ending: ${error.message}`);
    } else {
      const { error } = await admin.from('FormEnding').insert({ id: createRecordId(), formId, ...payload });
      if (error) throw new Error(`Unable to create ending: ${error.message}`);
    }
  }
}
