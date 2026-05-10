import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/forms/[id]/responses - List responses for a form
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const responses = await db.response.findMany({
      where: { formId: id },
      orderBy: { startedAt: 'desc' },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });
    
    const serialized = responses.map(r => ({
      ...r,
      metadata: JSON.parse(r.metadata),
      answers: r.answers.map(a => ({
        ...a,
        question: a.question ? {
          ...a.question,
          options: JSON.parse(a.question.options),
          imageUrls: JSON.parse(a.question.imageUrls),
          settings: JSON.parse(a.question.settings),
        } : undefined,
      })),
    }));
    
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching responses:', error);
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
  }
}

// POST /api/forms/[id]/responses - Submit a new response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Verify form exists and is published
    const form = await db.form.findUnique({ where: { id } });
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (!form.published) {
      return NextResponse.json({ error: 'Form is not published' }, { status: 400 });
    }
    
    // Create response
    const response = await db.response.create({
      data: {
        formId: id,
        completedAt: body.completedAt ? new Date(body.completedAt) : new Date(),
        metadata: JSON.stringify(body.metadata || {}),
      },
    });
    
    // Create answers
    if (body.answers && Array.isArray(body.answers)) {
      await Promise.all(
        body.answers.map((answer: { questionId: string; value: string }) =>
          db.answer.create({
            data: {
              responseId: response.id,
              questionId: answer.questionId,
              value: answer.value,
            },
          })
        )
      );
    }
    
    const result = await db.response.findUnique({
      where: { id: response.id },
      include: { answers: true },
    });
    
    const serialized = {
      ...result,
      metadata: JSON.parse(result?.metadata || '{}'),
    };
    
    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    console.error('Error creating response:', error);
    return NextResponse.json({ error: 'Failed to create response' }, { status: 500 });
  }
}

// DELETE /api/forms/[id]/responses - Delete all responses for a form
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify form exists
    const form = await db.form.findUnique({ where: { id } });
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Delete all answers first (cascade), then responses
    const responses = await db.response.findMany({
      where: { formId: id },
      select: { id: true },
    });

    const responseIds = responses.map(r => r.id);

    if (responseIds.length > 0) {
      await db.answer.deleteMany({
        where: { responseId: { in: responseIds } },
      });

      await db.response.deleteMany({
        where: { formId: id },
      });
    }

    return NextResponse.json({
      success: true,
      deletedCount: responseIds.length,
    });
  } catch (error) {
    console.error('Error deleting responses:', error);
    return NextResponse.json({ error: 'Failed to delete responses' }, { status: 500 });
  }
}
