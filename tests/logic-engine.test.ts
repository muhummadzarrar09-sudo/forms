import { describe, expect, test } from 'bun:test';
import { findLogicCycles, resolveLogicAction, ruleMatches } from '../src/lib/logic-engine';
import type { FormQuestion, LogicRule } from '../src/types/form';

function question(overrides: Partial<FormQuestion> = {}): FormQuestion {
  return {
    id: 'q1', formId: 'form1', type: 'short_text', title: 'Question', description: '',
    required: false, order: 0, options: [], imageUrls: [], settings: {}, logic: [],
    placeholder: '', createdAt: '', updatedAt: '', ...overrides,
  };
}

function rule(overrides: Partial<LogicRule> = {}): LogicRule {
  return {
    id: 'rule1',
    condition: { field: '', operator: 'equals', value: 'yes' },
    action: { type: 'jump_to', targetQuestionId: 'q2' },
    ...overrides,
  };
}

describe('logic engine', () => {
  test('uses every condition for ALL and any condition for ANY', () => {
    const q = question({ type: 'number' });
    const all = rule({
      conditions: [
        { field: '', operator: 'greater_than', value: '2' },
        { field: '', operator: 'less_than', value: '10' },
      ],
      conditionMatch: 'all',
    });
    const any = rule({ ...all, conditionMatch: 'any' });
    expect(ruleMatches(all, q, '5')).toBe(true);
    expect(ruleMatches(all, q, '11')).toBe(false);
    expect(ruleMatches(any, q, '11')).toBe(true);
  });

  test('supports existing choice rules and editor-selected option values', () => {
    const q = question({ type: 'multiple_choice' });
    expect(ruleMatches(rule({ condition: { field: 'old-option', operator: 'equals', value: '' } }), q, 'old-option')).toBe(true);
    expect(ruleMatches(rule({ condition: { field: 'default-option', operator: 'equals', value: 'chosen-option' } }), q, 'chosen-option')).toBe(true);
  });

  test('returns the first matching action in rule order', () => {
    const q = question({ logic: [
      rule({ id: 'first', action: { type: 'jump_to', targetQuestionId: 'q2' } }),
      rule({ id: 'second', action: { type: 'show_ending', targetQuestionId: 'ending1' } }),
    ] });
    expect(resolveLogicAction(q, 'yes')).toEqual({ type: 'jump_to', targetQuestionId: 'q2' });
  });

  test('finds self and multi-question jump cycles', () => {
    const q1 = question({ id: 'q1', logic: [rule({ action: { type: 'jump_to', targetQuestionId: 'q2' } })] });
    const q2 = question({ id: 'q2', logic: [rule({ action: { type: 'jump_to', targetQuestionId: 'q1' } })] });
    expect(findLogicCycles([q1, q2])).toEqual([['q1', 'q2', 'q1']]);
    expect(findLogicCycles([question({ logic: [rule({ action: { type: 'jump_to', targetQuestionId: 'q1' } })] })])).toEqual([['q1', 'q1']]);
  });
});
