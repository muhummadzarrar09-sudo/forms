import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/workspaces/[id] - Get workspace by ID with forms
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await db.workspace.findUnique({
      where: { id },
      include: {
        _count: { select: { forms: true } },
        forms: {
          orderBy: { updatedAt: 'desc' },
          include: {
            _count: { select: { responses: true } },
            questions: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const serialized = {
      ...workspace,
      forms: workspace.forms.map((form) => ({
        ...form,
        tags: JSON.parse(form.tags || '[]'),
        questions: form.questions.map((q) => ({
          ...q,
          options: JSON.parse(q.options),
          imageUrls: JSON.parse(q.imageUrls),
          settings: JSON.parse(q.settings),
          logic: JSON.parse(q.logic || '[]'),
        })),
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}

// PUT /api/workspaces/[id] - Update workspace
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const workspace = await db.workspace.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.order !== undefined && { order: body.order }),
      },
      include: {
        _count: { select: { forms: true } },
      },
    });

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id] - Delete workspace (move forms to no workspace)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First, set workspaceId to null for all forms in this workspace
    await db.form.updateMany({
      where: { workspaceId: id },
      data: { workspaceId: null },
    });

    // Then delete the workspace
    await db.workspace.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }
}
