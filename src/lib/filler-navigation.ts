import type { Form, FormQuestion } from '@/types/form';
import { resolveLogicAction } from '@/lib/logic-engine';

export type FillerStep =
  | { kind: 'question'; index: number }
  | { kind: 'submit' }
  | { kind: 'ending'; endingId: string };

export function getFillableQuestions(form: Form | null): FormQuestion[] {
  return form?.questions
    .filter((question) => question.type !== 'ending')
    .slice()
    .sort((left, right) => left.order - right.order) ?? [];
}

export function getCurrentQuestion(questions: FormQuestion[], index: number): FormQuestion | null {
  return index >= 0 && index < questions.length ? questions[index] : null;
}

export function requiredAnswerIsSatisfied(question: FormQuestion | null, answer: string | undefined): boolean {
  if (!question?.required) return true;
  if (question.type === 'legal') return answer === 'true';
  return Boolean(answer?.trim());
}

export function nextFillerStep(
  questions: FormQuestion[],
  currentIndex: number,
  answer: string
): FillerStep {
  const question = getCurrentQuestion(questions, currentIndex);
  if (!question) return { kind: 'submit' };

  const action = resolveLogicAction(question, answer);
  if (action?.type === 'show_ending') return { kind: 'ending', endingId: action.targetQuestionId };
  if (action?.targetQuestionId === '__submit__') return { kind: 'submit' };
  if (action?.targetQuestionId) {
    const targetIndex = questions.findIndex((candidate) => candidate.id === action.targetQuestionId);
    if (targetIndex !== -1) return { kind: 'question', index: targetIndex };
  }
  return currentIndex >= questions.length - 1
    ? { kind: 'submit' }
    : { kind: 'question', index: currentIndex + 1 };
}

export function fillerProgress(screen: string, currentIndex: number, totalQuestions: number): number {
  if (screen === 'welcome') return 0;
  if (screen === 'ending' || screen === 'submitting') return 100;
  if (totalQuestions === 0 || currentIndex < 0) return 0;
  return ((currentIndex + 1) / totalQuestions) * 100;
}
