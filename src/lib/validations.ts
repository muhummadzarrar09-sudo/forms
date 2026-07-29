/**
 * Zod validation schemas for API request bodies.
 *
 * These schemas enforce input constraints at the API boundary so that
 * malformed or out-of-range data is rejected with clear error messages
 * before reaching the database layer.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #FF5733)');
const isoDateTime = z.string().datetime({ offset: true }).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Must be a valid ISO-8601 datetime'
);
const questionType = z.enum([
  'short_text', 'long_text', 'multiple_choice', 'dropdown', 'email', 'number',
  'rating', 'opinion_scale', 'yes_no', 'date', 'picture_choice', 'phone',
  'website', 'legal', 'statement', 'ending',
]);

// Question settings are persisted as JSON. Bound their serialized size at the
// API boundary so arbitrary nested configuration cannot become a storage/CPU DoS.
const boundedSettings = z.record(z.unknown()).refine(
  (value) => JSON.stringify(value).length <= 20_000,
  'Question settings must not exceed 20KB'
);

/** External redirects must never be executable/data URLs. */
const safeHttpsUrl = z.string().url().max(2048).refine((value) => {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'URL must use HTTPS');

export const safeRedirectUrl = safeHttpsUrl;

export const createEndingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2_000).optional(),
  redirectUrl: safeRedirectUrl.nullable().optional(),
  showScore: z.boolean().optional(),
  order: z.number().int().min(0).max(10_000).optional(),
}).strict();

export const updateEndingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2_000).optional(),
  redirectUrl: safeRedirectUrl.nullable().optional(),
  showScore: z.boolean().optional(),
  order: z.number().int().min(0).max(10_000).optional(),
}).strict();

const shortId = z.string().min(1).max(100);
const hiddenFieldSchema = z.object({
  id: shortId,
  name: z.string().min(1).max(100),
  defaultValue: z.string().max(1_000).optional(),
});

const questionOptionSchema = z.object({
  id: shortId,
  label: z.string().min(1).max(200),
  image: safeHttpsUrl.optional(),
});

const logicConditionSchema = z.object({
  field: z.string().max(200),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_filled', 'is_empty']),
  value: z.string().max(1_000),
});

const logicRuleSchema = z.object({
  id: shortId,
  // `condition` remains required for backward-compatible existing rules.
  condition: logicConditionSchema,
  // New rules may evaluate every condition (ALL, default) or any condition.
  conditions: z.array(logicConditionSchema).min(1).max(10).optional(),
  conditionMatch: z.enum(['all', 'any']).optional(),
  action: z.object({
    type: z.enum(['jump_to', 'show_ending']),
    targetQuestionId: shortId,
  }),
});

// ---------------------------------------------------------------------------
// Form creation
// ---------------------------------------------------------------------------

export const createFormSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Untitled Form'),
  description: z.string().max(2000).optional().default(''),
  slug: z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens').optional().nullable(),
  welcomeTitle: z.string().max(200).optional(),
  welcomeMessage: z.string().max(1000).optional(),
  endingTitle: z.string().max(200).optional(),
  endingMessage: z.string().max(1000).optional(),
  theme: z.string().max(50).optional(),
  backgroundColor: hexColor.optional(),
  textColor: hexColor.optional(),
  buttonColor: hexColor.optional(),
  buttonTextColor: hexColor.optional(),
  fontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
  progressbar: z.boolean().optional(),
  showQuestionNumbers: z.boolean().optional(),
  allowBackNavigation: z.boolean().optional(),
  hiddenFields: z.array(hiddenFieldSchema).max(20).optional(),
  calculatedVariables: z.array(z.object({ id: shortId, name: z.string().min(1).max(50), formula: z.string().min(1).max(500) })).max(20).optional(),
  workspaceId: shortId.optional(),
});

// ---------------------------------------------------------------------------
// Form update
// ---------------------------------------------------------------------------

export const updateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  published: z.boolean().optional(),
  slug: z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens').optional().nullable(),
  welcomeTitle: z.string().max(200).optional(),
  welcomeMessage: z.string().max(1000).optional(),
  endingTitle: z.string().max(200).optional(),
  endingMessage: z.string().max(1000).optional(),
  theme: z.string().max(50).optional(),
  backgroundColor: hexColor.optional(),
  textColor: hexColor.optional(),
  buttonColor: hexColor.optional(),
  buttonTextColor: hexColor.optional(),
  fontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
  logoUrl: safeHttpsUrl.nullable().optional(),
  coverUrl: safeHttpsUrl.nullable().optional(),
  progressbar: z.boolean().optional(),
  showQuestionNumbers: z.boolean().optional(),
  allowBackNavigation: z.boolean().optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  hiddenFields: z.array(hiddenFieldSchema).max(20).optional(),
  calculatedVariables: z.array(z.object({ id: shortId, name: z.string().min(1).max(50), formula: z.string().min(1).max(500) })).max(20).optional(),
  workspaceId: shortId.nullable().optional(),
  maxResponses: z.number().int().min(0).optional(),
  closeDate: isoDateTime.nullable().optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Questions (batch save)
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  id: shortId.optional(),
  type: questionType,
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  required: z.boolean().optional().default(false),
  order: z.number().int().min(0).optional().default(0),
  options: z.array(questionOptionSchema).optional().default([]),
  imageUrls: z.array(safeHttpsUrl).max(20).optional().default([]),
  settings: boundedSettings.optional().default({}),
  logic: z.array(logicRuleSchema).optional().default([]),
  placeholder: z.string().max(200).optional().default(''),
});

export const saveQuestionsSchema = z.object({
  questions: z.array(questionSchema).min(0).max(100),
});

// ---------------------------------------------------------------------------
// Form response submission
// ---------------------------------------------------------------------------

export const submitResponseSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: shortId,
        value: z.string().max(10000),
      })
    )
    .min(1),
  metadata: boundedSettings.optional(),
  completedAt: isoDateTime.optional(),
});

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  color: hexColor.optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: hexColor.optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
});
