import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/server';

export type LegacyQuestionRow = {
  id: string;
  formId: string;
  type: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: string;
  imageUrls: string;
  settings: string;
  logic: string;
  placeholder: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyEndingRow = {
  id: string;
  formId: string;
  title: string;
  message: string;
  redirectUrl: string | null;
  showScore: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type LegacyWorkspaceRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyFormRow = {
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
  tags: string;
  hiddenFields: string;
  calculatedVariables: string;
  maxResponses: number;
  closeDate: string | null;
  metaTitle: string;
  metaDescription: string;
  userId: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HydratedLegacyForm = LegacyFormRow & {
  questions: LegacyQuestionRow[];
  endings: LegacyEndingRow[];
  workspace: LegacyWorkspaceRow | null;
  _count: { responses: number };
};

function queryError(context: string, error: { message: string }) {
  return new Error(`${context}: ${error.message}`);
}

function sortByOrder<T extends { order: number; id: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function normaliseForm(row: Record<string, unknown>): LegacyFormRow {
  // calculatedVariables is added by the reviewed minimal-schema preparation
  // migration. The fallback lets this helper report a coherent error-free shape
  // during a staged deployment before that migration is applied.
  return {
    ...row,
    calculatedVariables: typeof row.calculatedVariables === 'string' ? row.calculatedVariables : '[]',
  } as LegacyFormRow;
}

/**
 * Hydrates forms in the trusted server layer. Browser clients never receive a
 * direct table grant; callers must authenticate/authorize before invoking this.
 */
export async function hydrateLegacyForms(rows: Array<Record<string, unknown>>): Promise<HydratedLegacyForm[]> {
  if (rows.length === 0) return [];

  const admin = getSupabaseAdminClient();
  const forms = rows.map(normaliseForm);
  const formIds = forms.map((form) => form.id);
  const workspaceIds = [...new Set(forms.flatMap((form) => form.workspaceId ? [form.workspaceId] : []))];

  const [questionsResult, endingsResult, responsesResult, workspaceResult] = await Promise.all([
    admin.from('Question').select('*').in('formId', formIds).order('order', { ascending: true }),
    admin.from('FormEnding').select('*').in('formId', formIds).order('order', { ascending: true }),
    admin.from('Response').select('formId').in('formId', formIds),
    workspaceIds.length > 0
      ? admin.from('Workspace').select('*').in('id', workspaceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (questionsResult.error) throw queryError('Unable to load form questions', questionsResult.error);
  if (endingsResult.error) throw queryError('Unable to load form endings', endingsResult.error);
  if (responsesResult.error) throw queryError('Unable to count form responses', responsesResult.error);
  if (workspaceResult.error) throw queryError('Unable to load form workspaces', workspaceResult.error);

  const questionsByForm = new Map<string, LegacyQuestionRow[]>();
  for (const question of (questionsResult.data || []) as LegacyQuestionRow[]) {
    const group = questionsByForm.get(question.formId) || [];
    group.push(question);
    questionsByForm.set(question.formId, group);
  }

  const endingsByForm = new Map<string, LegacyEndingRow[]>();
  for (const ending of (endingsResult.data || []) as LegacyEndingRow[]) {
    const group = endingsByForm.get(ending.formId) || [];
    group.push(ending);
    endingsByForm.set(ending.formId, group);
  }

  const responseCounts = new Map<string, number>();
  for (const response of (responsesResult.data || []) as Array<{ formId: string }>) {
    responseCounts.set(response.formId, (responseCounts.get(response.formId) || 0) + 1);
  }

  const workspacesById = new Map(
    ((workspaceResult.data || []) as LegacyWorkspaceRow[]).map((workspace) => [workspace.id, workspace])
  );

  return forms.map((form) => ({
    ...form,
    questions: sortByOrder(questionsByForm.get(form.id) || []),
    endings: sortByOrder(endingsByForm.get(form.id) || []),
    workspace: form.workspaceId ? workspacesById.get(form.workspaceId) || null : null,
    _count: { responses: responseCounts.get(form.id) || 0 },
  }));
}

export async function getLegacyFormById(id: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from('Form').select('*').eq('id', id).maybeSingle();
  if (error) throw queryError('Unable to load form', error);
  if (!data) return null;
  const [form] = await hydrateLegacyForms([data as Record<string, unknown>]);
  return form || null;
}

export async function getLegacyFormBySlug(slug: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from('Form').select('*').eq('slug', slug).maybeSingle();
  if (error) throw queryError('Unable to load form', error);
  if (!data) return null;
  const [form] = await hydrateLegacyForms([data as Record<string, unknown>]);
  return form || null;
}

export async function listLegacyFormsForUser(legacyUserId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('Form')
    .select('*')
    .eq('userId', legacyUserId)
    .order('updatedAt', { ascending: false });
  if (error) throw queryError('Unable to load forms', error);
  return hydrateLegacyForms((data || []) as Array<Record<string, unknown>>);
}
