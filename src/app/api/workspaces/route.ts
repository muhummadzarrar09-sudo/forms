import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeWorkspace } from '@/lib/api-serialization';
import { createWorkspaceSchema } from '@/lib/validations';
import { unauthorized, validationError, badRequest, internalError } from '@/lib/api-errors';

// GET /api/workspaces - List all workspaces for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

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
    return internalError('Failed to fetch workspaces');
  }
}

// POST /api/workspaces - Create a new workspace
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

    const validation = createWorkspaceSchema.safeParse(body);
    if (!validation.success) return validationError(validation.error);

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
        color: data.color ?? '#2563EB',
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
    return internalError('Failed to create workspace');
  }
}
