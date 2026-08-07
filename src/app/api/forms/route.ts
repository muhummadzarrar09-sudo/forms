import { NextRequest, NextResponse } from 'next/server';
import { serializeForm } from '@/lib/api-serialization';
import { createFormSchema } from '@/lib/validations';
import { generateSlug, ensureUniqueSlug } from '@/lib/slug';
import { unauthorized, validationError, badRequest, notFound, internalError } from '@/lib/api-errors';
import { ensureAccessibleFormTheme } from '@/lib/form-theme';
import { createRecordId } from '@/lib/ids';
import { getSupabaseAdminClient, requireSupabaseLegacyUser } from '@/lib/supabase/server';
import { hydrateLegacyForms, listLegacyFormsForUser } from '@/lib/supabase/forms-data';

// GET /api/forms - List only forms owned by the independently verified caller.
export async function GET() {
  try {
    const user = await requireSupabaseLegacyUser();
    if (!user) return unauthorized();

    const forms = await listLegacyFormsForUser(user.legacyUserId);
    return NextResponse.json(forms.map(serializeForm));
  } catch (error) {
    console.error('Error fetching forms:', error);
    return internalError('Failed to fetch forms');
  }
}

// POST /api/forms - Create an owner-scoped form through the server-only client.
export async function POST(request: NextRequest) {
  try {
    const user = await requireSupabaseLegacyUser();
    if (!user) return unauthorized();

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');

    const validation = createFormSchema.safeParse(body);
    if (!validation.success) return validationError(validation.error);
    const data = validation.data;
    const admin = getSupabaseAdminClient();

    const accessiblePalette = ensureAccessibleFormTheme({
      backgroundColor: data.backgroundColor ?? '#FFFFFF',
      textColor: data.textColor ?? '#333333',
      buttonColor: data.buttonColor ?? '#1A1A1A',
      buttonTextColor: data.buttonTextColor ?? '#FFFFFF',
      fontFamily: data.fontFamily ?? 'sans',
    });

    // A workspace belongs to a private owner namespace; never trust an opaque
    // client workspace ID without checking that exact owner relationship.
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

    let slug: string | null = null;
    if (data.slug !== undefined) {
      if (data.slug) slug = await ensureUniqueSlug(data.slug);
    } else {
      const baseSlug = generateSlug(data.title || 'untitled-form');
      if (baseSlug) slug = await ensureUniqueSlug(baseSlug);
    }

    const insertData = {
      id: createRecordId(),
      title: data.title ?? 'Untitled Form',
      description: data.description ?? '',
      slug,
      welcomeTitle: data.welcomeTitle ?? 'Welcome!',
      welcomeMessage: data.welcomeMessage ?? 'Thanks for taking the time to fill this out.',
      endingTitle: data.endingTitle ?? 'Thank you!',
      endingMessage: data.endingMessage ?? 'Your response has been recorded.',
      theme: data.theme ?? 'default',
      backgroundColor: accessiblePalette.backgroundColor,
      textColor: accessiblePalette.textColor,
      buttonColor: accessiblePalette.buttonColor,
      buttonTextColor: accessiblePalette.buttonTextColor,
      fontFamily: data.fontFamily ?? 'sans',
      progressbar: data.progressbar ?? true,
      showQuestionNumbers: data.showQuestionNumbers ?? true,
      allowBackNavigation: data.allowBackNavigation ?? true,
      hiddenFields: JSON.stringify(data.hiddenFields ?? []),
      calculatedVariables: JSON.stringify(data.calculatedVariables ?? []),
      userId: user.legacyUserId,
      workspaceId: data.workspaceId ?? null,
    };

    const { data: created, error: createError } = await admin
      .from('Form')
      .insert(insertData)
      .select('*')
      .single();
    if (createError || !created) {
      // The global database unique index is the final slug race-condition
      // boundary; do not expose its implementation detail to the browser.
      if ((createError as { code?: string } | null)?.code === '23505') {
        return badRequest('That share URL is already in use. Please try again.');
      }
      throw new Error(`Unable to create form: ${createError?.message || 'unknown database error'}`);
    }

    const [form] = await hydrateLegacyForms([created]);
    return NextResponse.json(serializeForm(form), { status: 201 });
  } catch (error) {
    console.error('Error creating form:', error);
    return internalError('Failed to create form');
  }
}
