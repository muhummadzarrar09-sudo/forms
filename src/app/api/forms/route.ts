import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/forms - List all forms
// Updated: include favorite, archived fields
export async function GET() {
  try {
    const forms = await db.form.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });
    
    const serialized = forms.map(form => ({
      ...form,
      tags: JSON.parse(form.tags || '[]'),
      closeDate: form.closeDate ? form.closeDate.toISOString() : null,
      workspace: form.workspace ? {
        id: form.workspace.id,
        name: form.workspace.name,
        color: form.workspace.color,
        icon: form.workspace.icon,
        order: form.workspace.order,
        createdAt: form.workspace.createdAt.toISOString(),
        updatedAt: form.workspace.updatedAt.toISOString(),
      } : null,
      questions: form.questions.map(q => ({
        ...q,
        options: JSON.parse(q.options),
        imageUrls: JSON.parse(q.imageUrls),
        settings: JSON.parse(q.settings),
        logic: JSON.parse(q.logic || '[]'),
      })),
    }));
    
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
}

// POST /api/forms - Create a new form
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const form = await db.form.create({
      data: {
        title: body.title || 'Untitled Form',
        description: body.description || '',
        welcomeTitle: body.welcomeTitle || 'Welcome!',
        welcomeMessage: body.welcomeMessage || 'Thanks for taking the time to fill this out.',
        endingTitle: body.endingTitle || 'Thank you!',
        endingMessage: body.endingMessage || 'Your response has been recorded.',
        theme: body.theme || 'default',
        backgroundColor: body.backgroundColor || '#FFFFFF',
        textColor: body.textColor || '#333333',
        buttonColor: body.buttonColor || '#1A1A1A',
        buttonTextColor: body.buttonTextColor || '#FFFFFF',
        fontFamily: body.fontFamily || 'sans',
        progressbar: body.progressbar ?? true,
        showQuestionNumbers: body.showQuestionNumbers ?? true,
        allowBackNavigation: body.allowBackNavigation ?? true,
        ...(body.workspaceId && { workspaceId: body.workspaceId }),
      },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
        workspace: true,
      },
    });
    
    const serialized = {
      ...form,
      tags: JSON.parse(form.tags || '[]'),
      closeDate: form.closeDate ? form.closeDate.toISOString() : null,
      workspace: form.workspace ? {
        id: form.workspace.id,
        name: form.workspace.name,
        color: form.workspace.color,
        icon: form.workspace.icon,
        order: form.workspace.order,
        createdAt: form.workspace.createdAt.toISOString(),
        updatedAt: form.workspace.updatedAt.toISOString(),
      } : null,
      questions: form.questions.map(q => ({
        ...q,
        options: JSON.parse(q.options),
        imageUrls: JSON.parse(q.imageUrls),
        settings: JSON.parse(q.settings),
        logic: JSON.parse(q.logic || '[]'),
      })),
    };
    
    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    console.error('Error creating form:', error);
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
  }
}
