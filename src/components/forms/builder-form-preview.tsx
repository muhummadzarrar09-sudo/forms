'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import type { Form, FormEnding } from '@/types/form';
import { Button } from '@/components/ui/button';
import { FillerQuestionScreen } from '@/components/forms/filler-question-screen';
import { fillerProgress, getCurrentQuestion, getFillableQuestions, nextFillerStep, requiredAnswerIsSatisfied } from '@/lib/filler-navigation';
import { deriveFormTheme } from '@/lib/form-theme';

interface BuilderFormPreviewProps {
  form: Form;
}

type PreviewScreen = 'welcome' | 'question' | 'ending';

/**
 * A local, non-persisting respondent simulation used inside the builder.
 * It intentionally never calls the response API: creators can test a draft
 * safely while editing it.
 */
export function BuilderFormPreview({ form }: BuilderFormPreviewProps) {
  const questions = useMemo(() => getFillableQuestions(form), [form]);
  const [screen, setScreen] = useState<PreviewScreen>('welcome');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeEnding, setActiveEnding] = useState<FormEnding | null>(null);

  const question = getCurrentQuestion(questions, index);
  const progress = fillerProgress(screen, index, questions.length);
  const theme = deriveFormTheme(form);

  const reset = () => {
    setScreen('welcome');
    setIndex(0);
    setAnswers({});
    setActiveEnding(null);
  };

  const advance = () => {
    if (screen === 'welcome') {
      if (questions.length === 0) setScreen('ending');
      else setScreen('question');
      return;
    }
    if (screen !== 'question' || !question) return;

    const answer = answers[question.id];
    if (!requiredAnswerIsSatisfied(question, answer)) return;
    const step = nextFillerStep(questions, index, answer || '', answers);
    if (step.kind === 'question') {
      setIndex(step.index);
      return;
    }
    if (step.kind === 'ending') {
      setActiveEnding(
        step.endingId === '__default__'
          ? null
          : form.endings?.find((ending) => ending.id === step.endingId) ?? null
      );
    }
    setScreen('ending');
  };

  const goBack = () => {
    if (screen === 'question' && index > 0) setIndex((current) => current - 1);
    else if (screen === 'question') setScreen('welcome');
  };

  const endingTitle = activeEnding?.title || form.endingTitle || 'Thank you!';
  const endingMessage = activeEnding?.message || form.endingMessage || 'Your response has been recorded.';

  return (
    <section
      className="relative h-full min-h-0 overflow-hidden"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
      aria-label="Embedded form preview"
    >
      {form.progressbar && (
        <div className="absolute inset-x-0 top-0 z-10 h-1" style={{ backgroundColor: theme.trackColor }}>
          <div className="h-full transition-[width] duration-300" style={{ width: `${progress}%`, backgroundColor: theme.buttonColor }} />
        </div>
      )}

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {screen === 'question' && form.allowBackNavigation && (
          <Button variant="outline" size="sm" onClick={goBack} className="gap-1" style={{ color: theme.textColor, borderColor: theme.fieldBorderColor, backgroundColor: theme.controlSurfaceColor }}>
            <ArrowLeft className="size-3.5" /> Back
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={reset} className="gap-1" style={{ color: theme.textColor, borderColor: theme.fieldBorderColor, backgroundColor: theme.controlSurfaceColor }}>
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      </div>

      <div className="mx-auto flex h-full w-full max-w-3xl items-center px-6 py-16 md:px-12">
        {screen === 'welcome' && (
          <div className="max-w-2xl space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: theme.textSecondaryColor }}>Live draft preview</p>
            <h1 className={`text-4xl font-bold leading-tight md:text-6xl ${theme.fontFamily === 'serif' ? 'font-serif' : theme.fontFamily === 'mono' ? 'font-mono' : 'font-sans'}`}>
              {form.welcomeTitle || form.title}
            </h1>
            {form.welcomeMessage && <p className="max-w-xl text-lg" style={{ color: theme.textSecondaryColor }}>{form.welcomeMessage}</p>}
            <Button size="lg" className="mt-4 gap-2 rounded-full px-7" onClick={advance} style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}>
              Start preview
            </Button>
            <p className="text-xs" style={{ color: theme.textTertiaryColor }}>Answers stay local and are never submitted.</p>
          </div>
        )}

        {screen === 'question' && question && (
          <div className="w-full">
            <FillerQuestionScreen
              question={question}
              questionIndex={index}
              totalQuestions={questions.length}
              answer={answers[question.id] || ''}
              onAnswerChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
              onAdvance={advance}
              theme={theme}
              showQuestionNumbers={form.showQuestionNumbers}
            />
          </div>
        )}

        {screen === 'ending' && (
          <div className="max-w-2xl space-y-5 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full" style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}><Check className="size-9" aria-hidden="true" /></div>
            <h1 className="text-4xl font-bold md:text-5xl">{endingTitle}</h1>
            <p className="text-lg" style={{ color: theme.textSecondaryColor }}>{endingMessage}</p>
            <Button variant="outline" onClick={reset} style={{ color: theme.textColor, borderColor: theme.fieldHoverBorderColor, backgroundColor: theme.controlSurfaceColor }}>Preview again</Button>
          </div>
        )}
      </div>
    </section>
  );
}
