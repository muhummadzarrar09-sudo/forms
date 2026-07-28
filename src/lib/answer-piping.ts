/**
 * Replaces `{{answer:questionId}}` tokens with prior respondent answers.
 * Values remain plain React text, so answer content is never interpreted as HTML.
 */
export function pipeAnswerText(template: string, answers: Record<string, string>): string {
  return template.replace(/{{answer:([A-Za-z0-9_-]{1,100})}}/g, (_token, questionId: string) => {
    const value = answers[questionId]?.trim();
    return value || '';
  });
}
