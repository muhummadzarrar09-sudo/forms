import type { FormQuestion, LogicRule } from '@/types/form';

export type LogicAction = LogicRule['action'];

type LogicCondition = LogicRule['condition'];

/**
 * A pure, shared conditional-logic evaluator.
 *
 * Both form fillers must call this rather than keeping subtly different
 * implementations. `conditions`/`conditionMatch` are optional additions for
 * backward compatibility with the original single-condition rule shape.
 */
export function evaluateLogicCondition(
  condition: LogicCondition,
  question: FormQuestion,
  answer: string
): boolean {
  const { operator, value: conditionValue, field } = condition;
  const normalizedAnswer = answer.trim();

  if (operator === 'is_filled') return normalizedAnswer !== '';
  if (operator === 'is_empty') return normalizedAnswer === '';

  if (['multiple_choice', 'picture_choice', 'dropdown'].includes(question.type)) {
    const selectedIds = answer.split(',').map((item) => item.trim()).filter(Boolean);
    // Old rules stored the selected option in `field`; the editor stores a
    // user-selected option in `value`. Support both shapes during migration.
    const optionId = conditionValue || field;
    if (operator === 'equals') return selectedIds.length === 1 && selectedIds.includes(optionId);
    if (operator === 'not_equals') return !selectedIds.includes(optionId);
    if (operator === 'contains') return selectedIds.includes(optionId);
    return false;
  }

  if (question.type === 'yes_no') {
    const isYes = normalizedAnswer.toLowerCase() === 'yes' || normalizedAnswer === 'true';
    const isNo = normalizedAnswer.toLowerCase() === 'no' || normalizedAnswer === 'false';
    if (operator === 'equals') {
      if (field === 'yes') return isYes;
      if (field === 'no') return isNo;
    }
    if (operator === 'not_equals') {
      if (field === 'yes') return !isYes;
      if (field === 'no') return !isNo;
    }
  }

  if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
    const numericAnswer = Number(normalizedAnswer);
    const numericCondition = Number(conditionValue);
    if (!Number.isFinite(numericAnswer) || !Number.isFinite(numericCondition)) return false;
    switch (operator) {
      case 'equals': return numericAnswer === numericCondition;
      case 'not_equals': return numericAnswer !== numericCondition;
      case 'greater_than': return numericAnswer > numericCondition;
      case 'less_than': return numericAnswer < numericCondition;
      default: return false;
    }
  }

  const normalizedCondition = conditionValue.toLowerCase();
  switch (operator) {
    case 'equals': return normalizedAnswer.toLowerCase() === normalizedCondition;
    case 'not_equals': return normalizedAnswer.toLowerCase() !== normalizedCondition;
    case 'contains': return normalizedAnswer.toLowerCase().includes(normalizedCondition);
    default: return false;
  }
}

export function ruleMatches(rule: LogicRule, question: FormQuestion, answer: string): boolean {
  const conditions = rule.conditions?.length ? rule.conditions : [rule.condition];
  const matches = conditions.map((condition) => evaluateLogicCondition(condition, question, answer));
  return rule.conditionMatch === 'any' ? matches.some(Boolean) : matches.every(Boolean);
}

/** Returns the first matching action. Rule order is intentional and stable. */
export function resolveLogicAction(
  question: FormQuestion,
  answer: string
): LogicAction | null {
  for (const rule of question.logic || []) {
    if (ruleMatches(rule, question, answer)) return rule.action;
  }
  const targetQuestionId = question.settings?.jumpToQuestionId;
  return targetQuestionId ? { type: 'jump_to', targetQuestionId } : null;
}

/**
 * Reject self-jumps and potential question-to-question cycles at save time.
 * It is deliberately conservative: any configured jump edge participates,
 * regardless of condition, because a respondent must never be trapped.
 */
export function findLogicCycles(questions: FormQuestion[]): string[][] {
  const ids = new Set(questions.map((question) => question.id));
  const edges = new Map<string, string[]>();

  for (const question of questions) {
    const targets = [
      ...(question.logic || []).map((rule) => rule.action.targetQuestionId),
      question.settings?.jumpToQuestionId,
    ].filter((target): target is string =>
      typeof target === 'string' && target !== '' && target !== '__submit__' && ids.has(target)
    );
    edges.set(question.id, targets);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  const visit = (id: string) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      cycles.push([...path.slice(start), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    path.push(id);
    for (const target of edges.get(id) || []) visit(target);
    path.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of ids) visit(id);
  return cycles;
}
