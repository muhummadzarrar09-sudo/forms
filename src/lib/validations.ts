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

const questionOptionSchema = z.object({
  id: z.string(),
  label: z.string().max(200),
  image: z.string().url().optional(),
});

const logicRuleSchema = z.object({
  id: z.string(),
  condition: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']),
    value: z.string(),
  }),
  action: z.object({
    type: z.literal('jump_to'),
    targetQuestionId: z.string(),
  }),
});

// ---------------------------------------------------------------------------
// Form creation
// ---------------------------------------------------------------------------

export const createFormSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Untitled Form'),
  description: z.string().max(2000).optional().default(''),
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
  workspaceId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Form update
// ---------------------------------------------------------------------------

export const updateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  published: z.boolean().optional(),
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
  logoUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  progressbar: z.boolean().optional(),
  showQuestionNumbers: z.boolean().optional(),
  allowBackNavigation: z.boolean().optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  workspaceId: z.string().nullable().optional(),
  maxResponses: z.number().int().min(0).optional(),
  closeDate: z.string().nullable().optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Questions (batch save)
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  id: z.string().optional(),
  type: z.string().max(30),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  required: z.boolean().optional().default(false),
  order: z.number().int().min(0).optional().default(0),
  options: z.array(questionOptionSchema).optional().default([]),
  imageUrls: z.array(z.string().url()).optional().default([]),
  settings: z.record(z.unknown()).optional().default({}),
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
        questionId: z.string().min(1),
        value: z.string().max(10000),
      })
    )
    .min(1),
  metadata: z.record(z.unknown()).optional(),
  completedAt: z.string().optional(),
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
