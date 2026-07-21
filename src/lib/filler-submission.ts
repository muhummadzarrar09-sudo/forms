export interface FormSubmissionResult {
  ok: boolean;
  error?: string;
}

/**
 * Shared public-filler submission boundary. Keeping request construction and
 * error parsing here prevents the public slug filler and in-app preview from
 * drifting on answer/hidden-field payloads or failure behaviour.
 */
export interface PartialResponseCredential {
  responseId: string;
  editToken: string;
}

export async function submitFillerResponse(
  formId: string,
  answers: Record<string, string>,
  hiddenFields: Record<string, string> = {},
  partial?: PartialResponseCredential
): Promise<FormSubmissionResult> {
  const answerList = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }));
  const isCompletingPartial = Boolean(partial);

  try {
    const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/responses`, {
      method: isCompletingPartial ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isCompletingPartial ? {
        responseId: partial!.responseId,
        editToken: partial!.editToken,
        answers: answerList,
        isPartial: false,
        completedAt: new Date().toISOString(),
        metadata: {
          submittedAt: new Date().toISOString(),
          hiddenFields,
        },
      } : {
        answers: answerList,
        metadata: {
          submittedAt: new Date().toISOString(),
          hiddenFields,
        },
      }),
    });

    if (response.ok) return { ok: true };
    const body = await response.json().catch(() => ({}));
    return { ok: false, error: typeof body.error === 'string' ? body.error : 'Something went wrong submitting your response.' };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}
