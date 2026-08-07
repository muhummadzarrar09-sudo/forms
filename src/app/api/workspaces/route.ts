import { NextRequest, NextResponse } from 'next/server';
import { serializeWorkspace } from '@/lib/api-serialization';
import { createWorkspaceSchema } from '@/lib/validations';
import { unauthorized, validationError, badRequest, internalError } from '@/lib/api-errors';
import { createRecordId } from '@/lib/ids';
import { getSupabaseAdminClient, requireSupabaseLegacyUser } from '@/lib/supabase/server';

// GET /api/workspaces - Owner-scoped workspace list with form counts.
export async function GET() {
  try {
    const user = await requireSupabaseLegacyUser();
    if (!user) return unauthorized();

    const admin = getSupabaseAdminClient();
    const [workspaceResult, formsResult] = await Promise.all([
      admin.from('Workspace').select('*').eq('userId', user.legacyUserId).order('order', { ascending: true }),
      admin.from('Form').select('workspaceId').eq('userId', user.legacyUserId),
    ]);
    if (workspaceResult.error) throw new Error(`Unable to load workspaces: ${workspaceResult.error.message}`);
    if (formsResult.error) throw new Error(`Unable to count workspace forms: ${formsResult.error.message}`);

    const formCounts = new Map<string, number>();
    for (const form of (formsResult.data || []) as Array<{ workspaceId: string | null }>) {
      if (!form.workspaceId) continue;
      formCounts.set(form.workspaceId, (formCounts.get(form.workspaceId) || 0) + 1);
    }

    const serialized = (workspaceResult.data || []).map((workspace) => serializeWorkspace({
      ...workspace,
      _count: { forms: formCounts.get(workspace.id) || 0 },
    }));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return internalError('Failed to fetch workspaces');
  }
}

// POST /api/workspaces - Create a workspace owned by the authenticated user.
export async function POST(request: NextRequest) {
  try {
    const user = await requireSupabaseLegacyUser();
    if (!user) return unauthorized();

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');
    const validation = createWorkspaceSchema.safeParse(body);
    if (!validation.success) return validationError(validation.error);

    const data = validation.data;
    const admin = getSupabaseAdminClient();
    const { data: lastWorkspace, error: orderError } = await admin
      .from('Workspace')
      .select('order')
      .eq('userId', user.legacyUserId)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw new Error(`Unable to determine workspace order: ${orderError.message}`);

    const { data: workspace, error: createError } = await admin
      .from('Workspace')
      .insert({
        id: createRecordId(),
        name: data.name,
        color: data.color ?? '#2563EB',
        icon: data.icon ?? 'Folder',
        order: data.order ?? ((lastWorkspace?.order ?? -1) + 1),
        userId: user.legacyUserId,
      })
      .select('*')
      .single();
    if (createError || !workspace) {
      throw new Error(`Unable to create workspace: ${createError?.message || 'unknown database error'}`);
    }

    return NextResponse.json(serializeWorkspace({ ...workspace, _count: { forms: 0 } }), { status: 201 });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return internalError('Failed to create workspace');
  }
}
