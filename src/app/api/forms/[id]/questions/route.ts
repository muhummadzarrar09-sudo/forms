import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/forms/[id]/questions - Batch update/replace questions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const questions = body.questions as Array<{
      id?: string;
      type: string;
      title: string;
      description?: string;
      required?: boolean;
      order: number;
      options?: Array<{ id: string; label: string; image?: string }>;
      imageUrls?: string[];
      settings?: Record<string, unknown>;
      logic?: Array<{ id: string; condition: { field: string; operator: string; value: string }; action: { type: string; targetQuestionId: string } }>;
      placeholder?: string;
    }>;
    
    // Delete existing questions and recreate
    await db.question.deleteMany({ where: { formId: id } });
    
    const created = await Promise.all(
      questions.map((q, index) =>
        db.question.create({
          data: {
            formId: id,
            type: q.type,
            title: q.title,
            description: q.description || '',
            required: q.required || false,
            order: index,
            options: JSON.stringify(q.options || []),
            imageUrls: JSON.stringify(q.imageUrls || []),
            settings: JSON.stringify(q.settings || {}),
            logic: JSON.stringify(q.logic || []),
            placeholder: q.placeholder || '',
          },
        })
      )
    );
    
    const serialized = created.map(q => ({
      ...q,
      options: JSON.parse(q.options),
      imageUrls: JSON.parse(q.imageUrls),
      settings: JSON.parse(q.settings),
      logic: JSON.parse(q.logic || '[]'),
    }));
    
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error updating questions:', error);
    return NextResponse.json({ error: 'Failed to update questions' }, { status: 500 });
  }
}
