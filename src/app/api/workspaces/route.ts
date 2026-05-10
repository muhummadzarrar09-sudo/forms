import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeWorkspace } from '@/lib/api-serialization';
import { createWorkspaceSchema } from '@/lib/validations';

// GET /api/workspaces - List all workspaces for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaces = await db.workspace.findMany({
      where: { userId: session.user.id },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { forms: true } },
      },
    });

    const serialized = workspaces.map((ws) => serializeWorkspace(ws));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}

// POST /api/workspaces - Create a new workspace
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

    const validation = createWorkspaceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get the max order to place new workspace at the end
    const maxOrderWorkspace = await db.workspace.findFirst({
      where: { userId: session.user.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderWorkspace?.order ?? -1) + 1;

    const workspace = await db.workspace.create({
      data: {
        name: data.name,
        color: data.color ?? '#6366f1',
        icon: data.icon ?? 'Folder',
        order: data.order ?? nextOrder,
        userId: session.user.id,
      },
      include: {
        _count: { select: { forms: true } },
      },
    });

    return NextResponse.json(serializeWorkspace(workspace), { status: 201 });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
