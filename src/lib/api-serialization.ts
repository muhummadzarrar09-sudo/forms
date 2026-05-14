/**
 * Shared serialization utilities for API routes.
 * Centralizes the repeated JSON.parse/stringify logic for
 * tags, options, imageUrls, settings, logic, workspace, closeDate, metadata.
 */

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
  createdAt: Date | string;
  updatedAt: Date | string;
  _count?: { forms: number };
  forms?: unknown[];
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
  metadata: string;     // JSON string
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

/**
 * Serialize a raw Prisma question row, parsing JSON fields.
 */
export function serializeQuestion(q: RawQuestion) {
  return {
    ...q,
    options: JSON.parse(q.options),
    imageUrls: JSON.parse(q.imageUrls),
    settings: JSON.parse(q.settings),
    logic: JSON.parse(q.logic || '[]'),
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
    createdAt: ws.createdAt instanceof Date ? ws.createdAt.toISOString() : ws.createdAt,
    updatedAt: ws.updatedAt instanceof Date ? ws.updatedAt.toISOString() : ws.updatedAt,
    ...(ws._count !== undefined && { _count: ws._count }),
    ...(ws.forms !== undefined && { forms: ws.forms }),
  };
}

/**
 * Serialize a raw Prisma form row, parsing JSON fields and converting dates.
 */
export function serializeForm(form: RawForm) {
  return {
    ...form,
    tags: JSON.parse(form.tags || '[]'),
    hiddenFields: JSON.parse(form.hiddenFields || '[]'),
    closeDate: form.closeDate instanceof Date
      ? form.closeDate.toISOString()
      : form.closeDate,
    workspace: serializeWorkspace(form.workspace),
    questions: form.questions.map(serializeQuestion),
    endings: (form.endings || []).map(serializeEnding),
  };
}

/**
 * Serialize a raw Prisma response row, parsing metadata and question JSON fields.
 */
export function serializeResponse(r: RawResponse) {
  return {
    ...r,
    isPartial: r.isPartial ?? false,
    score: r.score ?? 0,
    metadata: JSON.parse(r.metadata),
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
