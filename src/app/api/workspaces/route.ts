import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/workspaces - List all workspaces with form counts
export async function GET() {
  try {
    const workspaces = await db.workspace.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { forms: true } },
      },
    });

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    // Get the max order to place new workspace at the end
    const maxOrderWorkspace = await db.workspace.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderWorkspace?.order ?? -1) + 1;

    const workspace = await db.workspace.create({
      data: {
        name: body.name.trim(),
        color: body.color || '#6366f1',
        icon: body.icon || 'Folder',
        order: body.order ?? nextOrder,
      },
      include: {
        _count: { select: { forms: true } },
      },
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
