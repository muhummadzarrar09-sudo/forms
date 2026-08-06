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

export function getQuestionTypeColor(_type: string): string {
  // Question category is communicated by its named Lucide icon. A neutral dot
  // avoids making arbitrary answer types look like success/warning states.
  return 'bg-primary/70';
}

// ── Confetti Colors (from form-filler.tsx) ──────────────────────────────────

export const CONFETTI_COLORS = ['#1D4ED8', '#0F766E', '#6D28D9', '#B45309', '#BE123C'];

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
      { value: 'is_filled', label: 'is filled' },
      { value: 'is_empty', label: 'is empty' },
    ];
  }
  if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
    return [
      { value: 'equals', label: 'equals' },
      { value: 'not_equals', label: 'does not equal' },
      { value: 'greater_than', label: 'is greater than' },
      { value: 'less_than', label: 'is less than' },
      { value: 'is_filled', label: 'is filled' },
      { value: 'is_empty', label: 'is empty' },
    ];
  }
  return [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'is_filled', label: 'is filled' },
    { value: 'is_empty', label: 'is empty' },
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
