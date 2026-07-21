import { describe, expect, test } from 'bun:test';
import { fillerProgress, getFillableQuestions, nextFillerStep, requiredAnswerIsSatisfied } from '../src/lib/filler-navigation';
import type { Form, FormQuestion } from '../src/types/form';

function question(overrides: Partial<FormQuestion> = {}): FormQuestion {
  return {
    id: 'q1', formId: 'form1', type: 'short_text', title: 'Question', description: '',
    required: false, order: 0, options: [], imageUrls: [], settings: {}, logic: [], placeholder: '', createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('shared filler navigation', () => {
  test('filters ending pseudo-questions without mutating the form order', () => {
    const form = { questions: [question({ id: 'ending', type: 'ending', order: 2 }), question({ id: 'q2', order: 1 }), question({ id: 'q1', order: 0 })] } as Form;
    expect(getFillableQuestions(form).map((item) => item.id)).toEqual(['q1', 'q2']);
    expect(form.questions.map((item) => item.id)).toEqual(['ending', 'q2', 'q1']);
  });

  test('requires actual consent for a required legal question', () => {
    const legal = question({ type: 'legal', required: true });
    expect(requiredAnswerIsSatisfied(legal, 'false')).toBe(false);
    expect(requiredAnswerIsSatisfied(legal, 'true')).toBe(true);
  });

  test('uses logic targets before normal advance and submits after the final question', () => {
    const first = question({ id: 'q1', logic: [{ id: 'r1', condition: { field: '', operator: 'equals', value: 'skip' }, action: { type: 'jump_to', targetQuestionId: 'q3' } }] });
    const second = question({ id: 'q2', order: 1 });
    const third = question({ id: 'q3', order: 2 });
    expect(nextFillerStep([first, second, third], 0, 'skip')).toEqual({ kind: 'question', index: 2 });
    expect(nextFillerStep([first, second, third], 0, 'continue')).toEqual({ kind: 'question', index: 1 });
    expect(nextFillerStep([first, second, third], 2, 'done')).toEqual({ kind: 'submit' });
  });

  test('uses a custom ending action and calculates progress consistently', () => {
    const q = question({ logic: [{ id: 'r1', condition: { field: '', operator: 'is_filled', value: '' }, action: { type: 'show_ending', targetQuestionId: 'ending1' } }] });
    expect(nextFillerStep([q], 0, 'yes')).toEqual({ kind: 'ending', endingId: 'ending1' });
    expect(fillerProgress('question', 1, 4)).toBe(50);
    expect(fillerProgress('ending', 1, 4)).toBe(100);
  });
});
