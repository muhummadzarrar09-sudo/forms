/**
 * Shared constants extracted from component files.
 * Prevents duplication of ICON_MAP, logic helpers, color mappings, etc.
 * across dashboard.tsx, form-builder.tsx, design-panel.tsx, form-filler.tsx.
 */

import type { QuestionType, FormQuestion, LogicRule } from '@/types/form';

// ── Question Type Categories ────────────────────────────────────────────────

export const QUESTION_TYPE_CATEGORIES: Record<string, string> = {
  short_text: 'Text',
  long_text: 'Text',
  multiple_choice: 'Choices',
  picture_choice: 'Choices',
  dropdown: 'Choices',
  yes_no: 'Choices',
  email: 'Fields',
  phone: 'Fields',
  number: 'Fields',
  website: 'Fields',
  date: 'Fields',
  rating: 'Rating',
  opinion_scale: 'Rating',
  legal: 'Other',
  statement: 'Other',
  ending: 'Other',
};

export const CATEGORY_ORDER = ['Text', 'Choices', 'Fields', 'Rating', 'Other'];

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Text: 'Free-form text inputs',
  Choices: 'Select from options',
  Fields: 'Specialized input fields',
  Rating: 'Scales and ratings',
  Other: 'Special question types',
};

// ── Question Type Category Color (for dots in builder) ──────────────────────

export function getQuestionTypeColor(type: string): string {
  const textTypes = ['short_text', 'long_text', 'email', 'phone', 'website'];
  const choiceTypes = ['multiple_choice', 'dropdown', 'picture_choice', 'yes_no'];
  const scaleTypes = ['rating', 'opinion_scale', 'number'];

  if (textTypes.includes(type)) return 'bg-blue-500';
  if (choiceTypes.includes(type)) return 'bg-emerald-500';
  if (scaleTypes.includes(type)) return 'bg-amber-500';
  return 'bg-gray-400';
}

// ── Confetti Colors (from form-filler.tsx) ──────────────────────────────────

export const CONFETTI_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
export const STAR_COLORS = ['#FFD700', '#FFA500', '#FF6347', '#FFD700'];

// ── Logic Helpers (from design-panel.tsx) ───────────────────────────────────

/** Question types that do not support conditional logic */
export const LOGIC_UNSUPPORTED_TYPES: QuestionType[] = ['statement', 'ending'];

/** Check if a question is a choice-based type (multiple choice, picture choice, dropdown, yes/no) */
export function isChoiceQuestion(question: FormQuestion): boolean {
  return ['multiple_choice', 'picture_choice', 'dropdown', 'yes_no'].includes(question.type);
}

/** Get the default condition field for a question type */
export function getDefaultField(question: FormQuestion): string {
  if (['multiple_choice', 'picture_choice', 'dropdown'].includes(question.type)) {
    return question.options[0]?.id || '';
  }
  if (question.type === 'yes_no') {
    return 'yes';
  }
  if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
    return 'value';
  }
  return 'answer';
}

/** Get the default operator for a question type */
export function getDefaultOperator(question: FormQuestion): LogicRule['condition']['operator'] {
  if (['multiple_choice', 'picture_choice', 'dropdown', 'yes_no'].includes(question.type)) {
    return 'equals';
  }
  if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
    return 'equals';
  }
  return 'contains';
}

/** Get available condition fields for a question */
export function getConditionFields(question: FormQuestion): { value: string; label: string }[] {
  if (['multiple_choice', 'picture_choice'].includes(question.type)) {
    return question.options.map((opt) => ({
      value: opt.id,
      label: opt.label,
    }));
  }
  if (question.type === 'dropdown') {
    return question.options.map((opt) => ({
      value: opt.id,
      label: opt.label,
    }));
  }
  if (question.type === 'yes_no') {
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ];
  }
  if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
    return [{ value: 'value', label: 'Value' }];
  }
  return [{ value: 'answer', label: 'Answer' }];
}

/** Get available operators for a question type */
export function getAvailableOperators(question: FormQuestion): { value: string; label: string }[] {
  if (['multiple_choice', 'picture_choice', 'dropdown', 'yes_no'].includes(question.type)) {
    return [
      { value: 'equals', label: 'equals' },
      { value: 'not_equals', label: 'does not equal' },
    ];
  }
  if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
    return [
      { value: 'equals', label: 'equals' },
      { value: 'not_equals', label: 'does not equal' },
      { value: 'greater_than', label: 'is greater than' },
      { value: 'less_than', label: 'is less than' },
    ];
  }
  return [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
  ];
}

/** Get choice options for a question (used in logic rule value selector) */
export function getChoiceOptions(question: FormQuestion): { value: string; label: string }[] {
  if (question.type === 'yes_no') {
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ];
  }
  return question.options.map((opt) => ({
    value: opt.id,
    label: opt.label,
  }));
}
