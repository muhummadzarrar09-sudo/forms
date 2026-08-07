/**
 * Shared serialization utilities for API routes.
 * Centralizes the repeated JSON.parse/stringify logic for
 * tags, options, imageUrls, settings, logic, workspace, closeDate, metadata.
 */

import type { FormQuestion, HiddenField, LogicRule, QuestionOption, QuestionSettings, QuestionType } from '@/types/form';

// ── Type for a raw Prisma question row (before JSON fields are parsed) ──────
interface RawQuestion {
  id: string;
  formId: string;
  type: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: string;    // JSON string
  imageUrls: string;  // JSON string
  settings: string;   // JSON string
  logic: string;      // JSON string
  placeholder: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── Type for a raw Prisma workspace row ─────────────────────────────────────
interface RawWorkspace {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  _count?: { forms: number };
}

// ── Type for a raw Prisma form row ──────────────────────────────────────────
interface RawForm {
  id: string;
  title: string;
  description: string;
  slug: string | null;
  published: boolean;
  welcomeTitle: string;
  welcomeMessage: string;
  endingTitle: string;
  endingMessage: string;
  theme: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: string;
  logoUrl: string | null;
  coverUrl: string | null;
  progressbar: boolean;
  showQuestionNumbers: boolean;
  allowBackNavigation: boolean;
  favorite: boolean;
  archived: boolean;
  tags: string;         // JSON string
  hiddenFields: string; // JSON string
  calculatedVariables: string;
  maxResponses: number;
  closeDate: Date | string | null;
  metaTitle: string;
  metaDescription: string;
  userId: string;
  workspaceId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  questions: RawQuestion[];
  endings: RawFormEnding[];
  workspace: RawWorkspace | null;
  _count?: { responses: number };
}

// ── Type for a raw Prisma response row ──────────────────────────────────────
interface RawResponse {
  id: string;
  formId: string;
  startedAt: Date | string;
  completedAt: Date | string | null;
  isPartial: boolean;
  score: number;
  status: string;
  internalNote: string;
  metadata: string;     // JSON string
  editTokenHash?: string | null;
  editTokenExpiresAt?: Date | string | null;
  answers: RawAnswer[];
}

interface RawAnswer {
  id: string;
  responseId: string;
  questionId: string;
  value: string;
  score: number;
  question?: RawQuestion | null;
}

interface RawFormEnding {
  id: string;
  formId: string;
  title: string;
  message: string;
  redirectUrl: string | null;
  showScore: boolean;
  order: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── Serialization Functions ─────────────────────────────────────────────────

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    const parsed = JSON.parse(value || '');
    return parsed === null || parsed === undefined ? fallback : parsed as T;
  } catch {
    return fallback;
  }
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed as T[] : [];
}

function parseJsonObject<T extends object>(value: string | null | undefined, fallback: T): T {
  const parsed = parseJson<unknown>(value, fallback);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : fallback;
}

function normalizeQuestionOptions(rawOptions: unknown): QuestionOption[] {
  if (!Array.isArray(rawOptions)) return [];

  return rawOptions.flatMap((option, index) => {
    if (typeof option === 'string') {
      const label = option.trim();
      return label ? [{ id: label, label }] : [];
    }
    if (!option || typeof option !== 'object') return [];

    const candidate = option as { id?: unknown; label?: unknown; image?: unknown };
    const label = typeof candidate.label === 'string' && candidate.label.trim()
      ? candidate.label
      : typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id
        : `Option ${index + 1}`;
    const id = typeof candidate.id === 'string' && candidate.id.trim()
      ? candidate.id
      : label;

    return [{
      id,
      label,
      ...(typeof candidate.image === 'string' && candidate.image ? { image: candidate.image } : {}),
    }];
  });
}

/**
 * Serialize a raw Prisma question row, parsing JSON fields.
 */
export function serializeQuestion(q: RawQuestion): FormQuestion {
  return {
    ...q,
    type: q.type as QuestionType,
    createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
    updatedAt: q.updatedAt instanceof Date ? q.updatedAt.toISOString() : q.updatedAt,
    options: normalizeQuestionOptions(parseJsonArray<unknown>(q.options)),
    imageUrls: parseJsonArray<string>(q.imageUrls).filter((url) => typeof url === 'string'),
    settings: parseJsonObject<QuestionSettings>(q.settings, {}),
    logic: parseJsonArray<LogicRule>(q.logic || '[]'),
  };
}

/**
 * Serialize a raw Prisma workspace row, converting Date fields to ISO strings.
 */
export function serializeWorkspace(ws: RawWorkspace | null) {
  if (!ws) return null;
  return {
    id: ws.id,
    name: ws.name,
    color: ws.color,
    icon: ws.icon,
    order: ws.order,
    userId: ws.userId,
    createdAt: ws.createdAt instanceof Date ? ws.createdAt.toISOString() : ws.createdAt,
    updatedAt: ws.updatedAt instanceof Date ? ws.updatedAt.toISOString() : ws.updatedAt,
    ...(ws._count !== undefined && { _count: ws._count }),
  };
}

/**
 * Serialize a raw Prisma form row, parsing JSON fields and converting dates.
 */
export function serializeForm(form: RawForm) {
  return {
    ...form,
    tags: parseJsonArray<string>(form.tags).filter((tag) => typeof tag === 'string'),
    hiddenFields: parseJsonArray<HiddenField>(form.hiddenFields),
    calculatedVariables: parseJsonArray<{ id: string; name: string; formula: string }>(form.calculatedVariables),
    closeDate: form.closeDate instanceof Date
      ? form.closeDate.toISOString()
      : form.closeDate,
    createdAt: form.createdAt instanceof Date ? form.createdAt.toISOString() : form.createdAt,
    updatedAt: form.updatedAt instanceof Date ? form.updatedAt.toISOString() : form.updatedAt,
    workspace: serializeWorkspace(form.workspace),
    questions: form.questions.map(serializeQuestion),
    endings: (form.endings || []).map(serializeEnding),
  };
}

/**
 * Public respondent payload. Keep the runtime shape convenient for existing
 * filler components while removing owner/workspace-only data.
 */
function serializePublicQuestion(question: RawQuestion) {
  const serialized = serializeQuestion(question);
  const settings = serialized.settings || {};

  // Keep only presentation/input constraints required by the respondent UI.
  // Never send routing, visibility, scoring, answer-key, or owner-contact
  // configuration to an unauthenticated browser.
  const publicSettings: QuestionSettings = {
    ...(typeof settings.steps === 'number' && { steps: settings.steps }),
    ...(typeof settings.startAtOne === 'boolean' && { startAtOne: settings.startAtOne }),
    ...(typeof settings.min === 'number' && { min: settings.min }),
    ...(typeof settings.max === 'number' && { max: settings.max }),
    ...(typeof settings.allowMultiple === 'boolean' && { allowMultiple: settings.allowMultiple }),
    ...(typeof settings.randomize === 'boolean' && { randomize: settings.randomize }),
    ...(typeof settings.requiredText === 'string' && { requiredText: settings.requiredText }),
  };

  return {
    id: serialized.id,
    formId: serialized.formId,
    type: serialized.type,
    title: serialized.title,
    description: serialized.description,
    required: serialized.required,
    order: serialized.order,
    options: serialized.options,
    imageUrls: serialized.imageUrls,
    settings: publicSettings,
    // Conditional/routing rules are evaluated in the trusted submission path
    // during the redesigned flow; exposing them leaks hidden branching.
    logic: [],
    placeholder: serialized.placeholder,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
  };
}

export function serializePublicForm(form: RawForm) {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    published: form.published,
    welcomeTitle: form.welcomeTitle,
    welcomeMessage: form.welcomeMessage,
    endingTitle: form.endingTitle,
    endingMessage: form.endingMessage,
    theme: form.theme,
    backgroundColor: form.backgroundColor,
    textColor: form.textColor,
    buttonColor: form.buttonColor,
    buttonTextColor: form.buttonTextColor,
    fontFamily: form.fontFamily,
    logoUrl: form.logoUrl,
    coverUrl: form.coverUrl,
    progressbar: form.progressbar,
    showQuestionNumbers: form.showQuestionNumbers,
    allowBackNavigation: form.allowBackNavigation,
    // Deliberately inert placeholders keep the client-facing Form shape stable
    // without disclosing owner-only configuration or response limits.
    favorite: false,
    archived: false,
    tags: [],
    hiddenFields: [],
    calculatedVariables: [],
    maxResponses: 0,
    closeDate: null,
    metaTitle: '',
    metaDescription: '',
    userId: '',
    workspaceId: null,
    workspace: null,
    createdAt: form.createdAt instanceof Date ? form.createdAt.toISOString() : form.createdAt,
    updatedAt: form.updatedAt instanceof Date ? form.updatedAt.toISOString() : form.updatedAt,
    questions: form.questions.map(serializePublicQuestion),
    endings: (form.endings || []).map((ending) => ({
      id: ending.id,
      formId: ending.formId,
      title: ending.title,
      message: ending.message,
      redirectUrl: ending.redirectUrl,
      // Scores are server-owned and must never be advertised in a public DTO.
      showScore: false,
      order: ending.order,
      createdAt: ending.createdAt instanceof Date ? ending.createdAt.toISOString() : ending.createdAt,
      updatedAt: ending.updatedAt instanceof Date ? ending.updatedAt.toISOString() : ending.updatedAt,
    })),
  };
}

/**
 * Serialize a raw Prisma response row, parsing metadata and question JSON fields.
 */
export function serializeResponse(r: RawResponse) {
  // Draft credential verifiers and expiry details are never owner/public data.
  const { editTokenHash: _editTokenHash, editTokenExpiresAt: _editTokenExpiresAt, ...response } = r;
  return {
    ...response,
    isPartial: r.isPartial ?? false,
    score: r.score ?? 0,
    metadata: parseJsonObject<Record<string, unknown>>(r.metadata, {}),
    answers: r.answers.map((a) => ({
      ...a,
      score: a.score ?? 0,
      question: a.question ? serializeQuestion(a.question) : undefined,
    })),
  };
}

export function serializeEnding(e: RawFormEnding) {
  return {
    ...e,
    redirectUrl: e.redirectUrl,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt,
  };
}
