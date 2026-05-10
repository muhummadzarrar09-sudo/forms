import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeResponse } from '@/lib/api-serialization';
import { submitResponseSchema } from '@/lib/validations';

// GET /api/forms/[id]/responses - List responses for a form (protected)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const serialized = responses.map((r) => serializeResponse(r));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching responses:', error);
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
  }
}

// POST /api/forms/[id]/responses - Submit a new response (PUBLIC — no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = submitResponseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify form exists and is published
    const form = await db.form.findUnique({ where: { id } });
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (!form.published) {
      return NextResponse.json({ error: 'Form is not published' }, { status: 400 });
    }

    // Enforce closeDate
    if (form.closeDate && new Date() > new Date(form.closeDate)) {
      return NextResponse.json(
        { error: 'This form is no longer accepting responses. The submission deadline has passed.' },
        { status: 403 }
      );
    }

    // Enforce maxResponses
    if (form.maxResponses > 0) {
      const currentResponseCount = await db.response.count({
        where: { formId: id },
      });
      if (currentResponseCount >= form.maxResponses) {
        return NextResponse.json(
          { error: `This form has reached its maximum response limit of ${form.maxResponses}.` },
          { status: 403 }
        );
      }
    }

    // Wrap response + answers creation in a transaction
    const result = await db.$transaction(async (tx) => {
      const response = await tx.response.create({
        data: {
          formId: id,
          completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
          metadata: JSON.stringify(data.metadata || {}),
        },
      });

      await Promise.all(
        data.answers.map((answer) =>
          tx.answer.create({
            data: {
              responseId: response.id,
              questionId: answer.questionId,
              value: answer.value,
            },
          })
        )
      );

      return tx.response.findUnique({
        where: { id: response.id },
        include: { answers: true },
      });
    });

    return NextResponse.json(
      serializeResponse(result!),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating response:', error);
    return NextResponse.json({ error: 'Failed to create response' }, { status: 500 });
  }
}

// DELETE /api/forms/[id]/responses - Delete all responses for a form (protected)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existingForm = await db.form.findUnique({ where: { id }, select: { userId: true } });
    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    if (existingForm.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete all answers first (cascade), then responses
    const responses = await db.response.findMany({
      where: { formId: id },
      select: { id: true },
    });

    const responseIds = responses.map((r) => r.id);

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
