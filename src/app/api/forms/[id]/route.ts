import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/forms/[id]
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
      },
    });
    
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    
    const serialized = {
      ...form,
      questions: form.questions.map(q => ({
        ...q,
        options: JSON.parse(q.options),
        imageUrls: JSON.parse(q.imageUrls),
        settings: JSON.parse(q.settings),
      })),
    };
    
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
}

// PUT /api/forms/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const form = await db.form.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.published !== undefined && { published: body.published }),
        ...(body.welcomeTitle !== undefined && { welcomeTitle: body.welcomeTitle }),
        ...(body.welcomeMessage !== undefined && { welcomeMessage: body.welcomeMessage }),
        ...(body.endingTitle !== undefined && { endingTitle: body.endingTitle }),
        ...(body.endingMessage !== undefined && { endingMessage: body.endingMessage }),
        ...(body.theme !== undefined && { theme: body.theme }),
        ...(body.backgroundColor !== undefined && { backgroundColor: body.backgroundColor }),
        ...(body.textColor !== undefined && { textColor: body.textColor }),
        ...(body.buttonColor !== undefined && { buttonColor: body.buttonColor }),
        ...(body.buttonTextColor !== undefined && { buttonTextColor: body.buttonTextColor }),
        ...(body.fontFamily !== undefined && { fontFamily: body.fontFamily }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.coverUrl !== undefined && { coverUrl: body.coverUrl }),
        ...(body.progressbar !== undefined && { progressbar: body.progressbar }),
        ...(body.showQuestionNumbers !== undefined && { showQuestionNumbers: body.showQuestionNumbers }),
        ...(body.allowBackNavigation !== undefined && { allowBackNavigation: body.allowBackNavigation }),
      },
      include: {
        _count: { select: { responses: true } },
        questions: { orderBy: { order: 'asc' } },
      },
    });
    
    const serialized = {
      ...form,
      questions: form.questions.map(q => ({
        ...q,
        options: JSON.parse(q.options),
        imageUrls: JSON.parse(q.imageUrls),
        settings: JSON.parse(q.settings),
      })),
    };
    
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
  }
}

// DELETE /api/forms/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.form.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form:', error);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
}
