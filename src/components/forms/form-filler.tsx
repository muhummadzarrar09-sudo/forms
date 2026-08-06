'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, type Transition, type Variants } from 'framer-motion';
import { useFormStore } from '@/store/form-store';
import type { Form, FormQuestion, FormEnding } from '@/types/form';
import { FillerQuestionScreen } from '@/components/forms/filler-question-screen';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { FillerConfetti, FillerHeaderLogo, FillerWelcomeBranding, FillerWelcomeMeta, useFillerKeyboardNavigation, useFillerTheme } from '@/components/forms/filler-shell';
import { BrandMark } from '@/components/brand-mark';
import { getCurrentQuestion, getFillableQuestions, fillerProgress, nextFillerStep, requiredAnswerIsSatisfied } from '@/lib/filler-navigation';
import { submitFillerResponse } from '@/lib/filler-submission';
import { pipeAnswerText } from '@/lib/answer-piping';
import { interpolateCalculatedText, resolveCalculatedVariables } from '@/lib/calculation-engine';

/* ─── Blinking cursor animation ────────────────────────────────────────── */

/* ─── Types ──────────────────────────────────────────────────────────── */

type FillerScreen = 'welcome' | 'question' | 'ending' | 'submitting' | 'error' | 'not-found' | 'not-published';

interface FillerState {
  form: Form | null;
  screen: FillerScreen;
  currentIndex: number; // -1 = welcome, 0..n-1 = questions
  answers: Record<string, string>;
  scores: Record<string, number>; // questionId -> score
  direction: 1 | -1; // 1 = forward, -1 = backward
  isLoading: boolean;
  errorMessage: string;
  activeEnding: FormEnding | null; // custom ending to display (null = default)
  partialResponseId: string | null; // ID of the partial response being tracked
  partialEditToken: string | null; // bearer token required to resume this anonymous response
  hiddenFieldValues: Record<string, string>; // hidden field values from URL params
  draftSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

/* ─── Animation variants ─────────────────────────────────────────────── */

const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 80 : -80,
    x: direction > 0 ? 10 : -10,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    y: 0,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    y: direction > 0 ? -80 : 80,
    x: direction > 0 ? -10 : 10,
    opacity: 0,
    scale: 0.98,
  }),
};

const questionTransition: Transition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
};

const fadeVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const checkmarkVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
      delay: 0.3,
    },
  },
};

/* ─── Font helper ────────────────────────────────────────────────────── */

function fontFamilyClass(ff: string) {
  return ff === 'serif' ? 'font-serif' : ff === 'mono' ? 'font-mono' : 'font-sans';
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export function FormFiller() {
  const { selectedFormId, openDashboard, shareMode } = useFormStore();

  const [showConfetti, setShowConfetti] = useState(false);
  // Tracks the current anonymous draft across renders without exposing it in UI.
  const partialResponseRef = useRef<string | null>(null);
  const autosaveInFlightRef = useRef(false);

  const [state, setState] = useState<FillerState>({
    form: null,
    screen: 'welcome',
    currentIndex: -1,
    answers: {},
    scores: {},
    direction: 1,
    isLoading: true,
    errorMessage: '',
    activeEnding: null,
    partialResponseId: null,
    partialEditToken: null,
    hiddenFieldValues: {},
    draftSaveStatus: 'idle',
  });

  const handleClose = useCallback(() => {
    if (shareMode) {
      // In share mode, close the tab/window
      window.close();
    } else {
      openDashboard();
    }
  }, [shareMode, openDashboard]);

  // Auto-hide confetti after animation
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Reset form for "Submit another response"
  const handleSubmitAnother = useCallback(() => {
    partialResponseRef.current = null;
    setState((prev) => ({
      ...prev,
      form: prev.form,
      screen: 'welcome' as const,
      currentIndex: -1,
      answers: {},
      scores: {},
      direction: 1 as const,
      isLoading: false,
      errorMessage: '',
      activeEnding: null,
      partialResponseId: null,
      partialEditToken: null,
      draftSaveStatus: 'idle',
    }));
  }, []);

  // Extract hidden field values from URL query parameters
  const hiddenFieldValues = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const urlParams = new URLSearchParams(window.location.search);
    const values: Record<string, string> = {};
    // We'll populate this after form loads — stored in state instead
    return values;
  }, []);

  // Fetch form
  useEffect(() => {
    let cancelled = false;

    const fetchForm = async () => {
      if (!selectedFormId) {
        if (!cancelled) {
          setState((s) => ({ ...s, isLoading: false, screen: 'not-found', errorMessage: 'No form selected.' }));
        }
        return;
      }

      setState((s) => ({ ...s, isLoading: true }));
      try {
        const res = await fetch(`/api/forms/${selectedFormId}`);
        if (!res.ok) {
          if (!cancelled) {
            setState((s) => ({
              ...s,
              isLoading: false,
              screen: 'not-found',
              errorMessage: 'This form could not be found.',
            }));
          }
          return;
        }
        const data: Form = await res.json();
        if (!cancelled) {
          // Extract hidden field values from URL query parameters
          const urlParams = new URLSearchParams(window.location.search);
          const hfValues: Record<string, string> = {};
          for (const hf of (data.hiddenFields || [])) {
            const paramValue = urlParams.get(hf.name);
            if (paramValue !== null) {
              hfValues[hf.id] = paramValue;
            } else if (hf.defaultValue) {
              hfValues[hf.id] = hf.defaultValue;
            }
          }

          if (!data.published && shareMode) {
            setState((s) => ({
              ...s,
              isLoading: false,
              form: data,
              screen: 'not-published',
              hiddenFieldValues: hfValues,
            }));
          } else {
            setState((s) => ({
              ...s,
              isLoading: false,
              form: data,
              screen: 'welcome',
              hiddenFieldValues: hfValues,
            }));
          }
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isLoading: false,
            screen: 'error',
            errorMessage: 'Failed to load the form. Please try again.',
          }));
        }
      }
    };

    fetchForm();
    return () => { cancelled = true; };
  }, [selectedFormId]);

  const questions = useMemo(() => getFillableQuestions(state.form), [state.form]);
  const currentQuestion = useMemo(() => getCurrentQuestion(questions, state.currentIndex), [state.currentIndex, questions]);
  const calculatedVariables = useMemo(() => resolveCalculatedVariables(state.form?.calculatedVariables || [], state.answers), [state.form?.calculatedVariables, state.answers]);
  const personalizedText = useCallback((text: string) => interpolateCalculatedText(pipeAnswerText(text, state.answers), state.answers, calculatedVariables), [state.answers, calculatedVariables]);

  // ── Submit ──
  // Use a ref to always have the latest answers (avoids stale closure)
  const answersRef = useRef(state.answers);
  const formRef = useRef(state.form);
  
  useEffect(() => {
    answersRef.current = state.answers;
  }, [state.answers]);
  
  useEffect(() => {
    formRef.current = state.form;
  }, [state.form]);

  const handleSubmit = useCallback(async () => {
    const currentForm = formRef.current;
    if (!currentForm) return;
    setState((s) => ({ ...s, screen: 'submitting', direction: 1 }));

    // Draft preview intentionally never creates a production response.
    if (!shareMode && !currentForm.published) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setState((s) => ({ ...s, screen: 'ending', direction: 1, activeEnding: null }));
      setShowConfetti(true);
      return;
    }

    const partial = state.partialResponseId && state.partialEditToken
      ? { responseId: state.partialResponseId, editToken: state.partialEditToken }
      : undefined;
    const result = await submitFillerResponse(currentForm.id, answersRef.current, state.hiddenFieldValues, partial);
    if (!result.ok) {
      setState((s) => ({ ...s, screen: 'error', errorMessage: result.error || 'Something went wrong submitting your response.' }));
      return;
    }
    setState((s) => ({ ...s, screen: 'ending', direction: 1, activeEnding: null, partialResponseId: null, partialEditToken: null }));
    setShowConfetti(true);
  }, [shareMode, state.hiddenFieldValues, state.partialResponseId, state.partialEditToken]);

  // ── Navigation ──
  const goNext = useCallback(async () => {
    if (state.screen === 'welcome') {
      if (questions.length === 0) {
        setState((current) => ({ ...current, screen: 'ending', direction: 1 }));
        setShowConfetti(true);
      } else {
        setState((current) => ({ ...current, screen: 'question', currentIndex: 0, direction: 1 }));
      }
      return;
    }
    if (state.screen !== 'question' || !currentQuestion) return;

    const answer = answersRef.current[currentQuestion.id];
    if (!requiredAnswerIsSatisfied(currentQuestion, answer)) return;
    const step = nextFillerStep(questions, state.currentIndex, answer || '', answersRef.current);
    if (step.kind === 'question') {
      setState((current) => ({ ...current, currentIndex: step.index, direction: 1 }));
      return;
    }
    if (step.kind === 'submit' || step.endingId === '__default__') {
      handleSubmit();
      return;
    }

    const ending = state.form?.endings?.find((candidate) => candidate.id === step.endingId);
    if (!ending) {
      handleSubmit();
      return;
    }
    const currentForm = formRef.current;
    if (shareMode && currentForm?.published) {
      setState((current) => ({ ...current, screen: 'submitting', direction: 1 }));
      const partial = state.partialResponseId && state.partialEditToken
        ? { responseId: state.partialResponseId, editToken: state.partialEditToken }
        : undefined;
      const result = await submitFillerResponse(currentForm.id, answersRef.current, state.hiddenFieldValues, partial);
      if (!result.ok) {
        setState((current) => ({ ...current, screen: 'error', errorMessage: result.error || 'Something went wrong submitting your response.' }));
        return;
      }
    }
    setState((current) => ({
      ...current,
      screen: 'ending',
      direction: 1,
      activeEnding: ending,
      partialResponseId: null,
      partialEditToken: null,
    }));
    setShowConfetti(true);
  }, [state.screen, state.currentIndex, state.form?.endings, state.hiddenFieldValues, state.partialResponseId, state.partialEditToken, questions, currentQuestion, handleSubmit, shareMode]);

  const goBack = useCallback(() => {
    if (state.screen === 'question' && state.currentIndex > 0) {
      setState((s) => ({
        ...s,
        currentIndex: s.currentIndex - 1,
        direction: -1,
      }));
    } else if (state.screen === 'question' && state.currentIndex === 0) {
      setState((s) => ({ ...s, screen: 'welcome', direction: -1 }));
    } else if (state.screen === 'ending') {
      setState((s) => ({
        ...s,
        screen: 'question',
        currentIndex: questions.length - 1,
        direction: -1,
      }));
    }
  }, [state.screen, state.currentIndex, questions.length]);

  // ── Score calculation ──

  const calculateScoreForAnswer = useCallback((
    question: FormQuestion,
    answerValue: string
  ): number => {
    const settings = question.settings || {};
    if (!settings.scoringEnabled) return 0;

    // Choice questions
    if (['multiple_choice', 'picture_choice', 'dropdown'].includes(question.type)) {
      const scoreValues = settings.scoreValues || {};
      const selectedIds = answerValue.split(',').map((s) => s.trim());
      let total = 0;
      for (const id of selectedIds) {
        total += scoreValues[id] || 0;
      }
      return total;
    }

    // Yes/No
    if (question.type === 'yes_no') {
      const scoreValues = settings.scoreValues || {};
      const key = answerValue.toLowerCase();
      return scoreValues[key] || 0;
    }

    // Rating / Opinion Scale / Number
    if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
      const numValue = parseFloat(answerValue);
      if (isNaN(numValue)) return 0;
      if (settings.correctAnswer) {
        const correctNum = parseFloat(settings.correctAnswer);
        if (!isNaN(correctNum) && numValue === correctNum) {
          return settings.points || 0;
        }
        return 0;
      }
      if (settings.points && settings.points > 0) {
        return numValue * settings.points;
      }
      return 0;
    }

    // Text-based: correct answer matching
    if (settings.correctAnswer) {
      const isCorrect = answerValue.trim().toLowerCase() === settings.correctAnswer.trim().toLowerCase();
      return isCorrect ? (settings.points || 0) : 0;
    }

    return 0;
  }, []);

  // ── Answer handler ──

  const setAnswer = useCallback((questionId: string, value: string) => {
    setState((s) => {
      // Find the question to calculate score
      const question = s.form?.questions.find((q) => q.id === questionId);
      const score = question ? calculateScoreForAnswer(question, value) : 0;
      return {
        ...s,
        answers: { ...s.answers, [questionId]: value },
        scores: { ...s.scores, [questionId]: score },
      };
    });
  }, [calculateScoreForAnswer]);

  // ── Partial response saving ──

  // Create partial response when form starts
  useEffect(() => {
    if (state.screen !== 'question' || !state.form || !shareMode || !state.form.published) return;
    if (partialResponseRef.current) return; // Already created

    const createPartial = async () => {
      try {
        const res = await fetch(`/api/forms/${state.form!.id}/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isPartial: true,
            answers: [],
            metadata: { startedAt: new Date().toISOString() },
          }),
        });
        if (!res.ok) {
          setState((s) => ({ ...s, draftSaveStatus: 'error' }));
          return;
        }
        const data = await res.json();
        if (!data.id || !data.editToken) {
          setState((s) => ({ ...s, draftSaveStatus: 'error' }));
          return;
        }
        partialResponseRef.current = data.id;
        setState((s) => ({
          ...s,
          partialResponseId: data.id,
          partialEditToken: data.editToken,
          draftSaveStatus: 'saved',
        }));
      } catch {
        setState((s) => ({ ...s, draftSaveStatus: 'error' }));
      }
    };

    createPartial();
  }, [state.screen, state.form, shareMode]);

  // Periodically update partial response with current answers
  useEffect(() => {
    if (!state.partialResponseId || !state.partialEditToken || !state.form || !shareMode) return;

    const interval = setInterval(async () => {
      // Do not overlap network writes: an earlier slow request must finish
      // before the next autosave can send a newer snapshot.
      if (autosaveInFlightRef.current) return;
      const currentAnswers = answersRef.current;
      const answerList = Object.entries(currentAnswers).map(([questionId, value]) => ({
        questionId,
        value,
      }));

      if (answerList.length === 0) return;

      autosaveInFlightRef.current = true;
      setState((s) => ({ ...s, draftSaveStatus: 'saving' }));
      try {
        const response = await fetch(`/api/forms/${state.form!.id}/responses`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responseId: state.partialResponseId,
            editToken: state.partialEditToken,
            answers: answerList,
            isPartial: true,
          }),
        });
        setState((s) => ({ ...s, draftSaveStatus: response.ok ? 'saved' : 'error' }));
      } catch {
        setState((s) => ({ ...s, draftSaveStatus: 'error' }));
      } finally {
        autosaveInFlightRef.current = false;
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(interval);
  }, [state.partialResponseId, state.partialEditToken, state.form, shareMode, state.scores]);

  useFillerKeyboardNavigation(goNext, goBack);

  // ── Progress calculation ──
  const progress = useMemo(
    () => fillerProgress(state.screen, state.currentIndex, questions.length),
    [state.screen, state.currentIndex, questions.length]
  );

  // ── Theme ──
  const theme = useFillerTheme(state.form);

  const ff = fontFamilyClass(theme.fontFamily);

  // ── Render ──

  // Loading
  if (state.isLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className="size-8 animate-spin"
            style={{ color: theme.textColor }}
          />
          <p className={`text-sm ${ff}`} style={{ color: theme.textSecondaryColor }}>
            Loading form...
          </p>
        </div>
      </div>
    );
  }

  // Not found
  if (state.screen === 'not-found') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <div className="text-center space-y-4 max-w-md px-6">
          <X className="size-16 mx-auto" style={{ color: theme.textTertiaryColor }} />
          <h2 className={`text-2xl font-bold ${ff}`} style={{ color: theme.textColor }}>
            Form not found
          </h2>
          <p className={`text-base ${ff}`} style={{ color: theme.textSecondaryColor }}>
            {state.errorMessage || 'This form doesn\'t exist or has been removed.'}
          </p>
          {!shareMode && (
            <button
              onClick={openDashboard}
              className="mt-4 inline-flex min-h-11 items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
            >
              <ArrowLeft className="size-4" />
              Go back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Not published
  if (state.screen === 'not-published') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <div className="text-center space-y-4 max-w-md px-6">
          <X className="size-16 mx-auto" style={{ color: theme.textTertiaryColor }} />
          <h2 className={`text-2xl font-bold ${ff}`} style={{ color: theme.textColor }}>
            This form is not accepting responses
          </h2>
          <p className={`text-base ${ff}`} style={{ color: theme.textSecondaryColor }}>
            The form owner has not published this form yet.
          </p>
          {!shareMode && (
            <button
              onClick={openDashboard}
              className="mt-4 inline-flex min-h-11 items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
            >
              <ArrowLeft className="size-4" />
              Go back
            </button>
          )}
        </div>
        {shareMode && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <p className={`text-xs ${ff} flex items-center gap-1`} style={{ color: theme.textTertiaryColor }}>
              Powered by <BrandMark className="size-4" title="Forms" /><span className="font-semibold">Forms</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // Error
  if (state.screen === 'error') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <div className="text-center space-y-4 max-w-md px-6">
          <X className="size-16 mx-auto" style={{ color: theme.errorColor }} />
          <h2 className={`text-2xl font-bold ${ff}`} style={{ color: theme.textColor }}>
            Something went wrong
          </h2>
          <p className={`text-base ${ff}`} style={{ color: theme.textSecondaryColor }}>
            {state.errorMessage}
          </p>
          {!shareMode ? (
            <button
              onClick={openDashboard}
              className="mt-4 inline-flex min-h-11 items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
            >
              <ArrowLeft className="size-4" />
              Go back
            </button>
          ) : (
            <button
              onClick={() => setState((s) => ({ ...s, screen: 'welcome', direction: -1 }))}
              className="mt-4 inline-flex min-h-11 items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
            >
              <RotateCcw className="size-4" />
              Try again
            </button>
          )}
        </div>
        {shareMode && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <p className={`text-xs ${ff} flex items-center gap-1`} style={{ color: theme.textTertiaryColor }}>
              Powered by <BrandMark className="size-4" title="Forms" /><span className="font-semibold">Forms</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!state.form) return null;

  // ── Main content key for AnimatePresence ──
  const screenKey = state.screen === 'question'
    ? `question-${state.currentIndex}`
    : state.screen;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {/* ── Confetti ── */}
      {showConfetti && state.screen === 'ending' && <FillerConfetti colors={[theme.buttonColor, theme.textColor, theme.successColor]} />}
      {state.screen !== 'welcome' && <FillerHeaderLogo form={state.form} theme={theme} />}



      {/* ── Progress Bar ── */}
      {state.form.progressbar && (
        <div
          className="absolute top-0 left-0 right-0 h-1.5 z-30"
          style={{ backgroundColor: theme.trackColor }}
          role="progressbar"
          aria-label="Form completion progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <motion.div
            className="h-full relative progress-bar-glow"
            style={{
              backgroundColor: theme.buttonColor,
              color: theme.buttonColor,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Dot indicator at current progress position */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 size-3 rounded-full border-2"
              style={{
                backgroundColor: theme.buttonColor,
                borderColor: theme.backgroundColor
              }}
            />
          </motion.div>
        </div>
      )}

      {/* ── Close button ── */}
      {!shareMode && (
        <button
          onClick={openDashboard}
          className="absolute top-4 right-4 z-30 size-11 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
          style={{ backgroundColor: theme.controlSurfaceColor, color: theme.textColor }}
          aria-label="Close form"
        >
          <X className="size-5" />
        </button>
      )}
      {shareMode && state.screen !== 'ending' && (
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-30 size-11 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
          style={{ backgroundColor: theme.controlSurfaceColor, color: theme.textColor }}
          aria-label="Close form"
        >
          <X className="size-5" />
        </button>
      )}

      {/* ── Preview mode banner for unpublished forms ── */}
      {!state.form.published && !shareMode && (
        <div className="absolute top-0 left-0 right-0 z-40 bg-info text-info-foreground py-2 text-center text-sm font-medium">
          Preview only — responses are not being collected
        </div>
      )}

      {/* ── Main content area ── */}
      <div className={`filler-scroll-region flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col justify-center px-6 sm:px-8 md:px-16 lg:px-24 py-24 md:py-28 relative ${!state.form.published && !shareMode ? 'pt-28' : ''}`}>
        <AnimatePresence mode="wait" custom={state.direction}>
          {/* Welcome Screen */}
          {state.screen === 'welcome' && (
            <motion.div
              key="welcome"
              custom={state.direction}
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-2xl mx-auto w-full"
            >
              <div className="space-y-6">
                <FillerWelcomeBranding form={state.form} theme={theme} />
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                  className={`text-4xl md:text-6xl font-bold leading-tight ${ff}`}
                  style={{ color: theme.textColor }}
                >
                  {personalizedText(state.form.welcomeTitle || state.form.title || 'Welcome!')}
                  {/* Blinking cursor */}
                  <span
                    className="inline-block w-0.5 h-[0.8em] ml-1 align-middle rounded-sm animate-[blink_1s_step-end_infinite]"
                    style={{ backgroundColor: theme.textColor }}
                  />
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
                  className={`text-lg md:text-xl ${ff}`}
                  style={{ color: theme.textSecondaryColor }}
                >
                  {personalizedText(state.form.welcomeMessage || 'Thanks for taking the time to fill this out.')}
                </motion.p>
                <FillerWelcomeMeta questionCount={questions.length} color={theme.textSecondaryColor} />
              </div>
            </motion.div>
          )}

          {/* Question Screen */}
          {state.screen === 'question' && currentQuestion && (
            <motion.div
              key={screenKey}
              custom={state.direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={questionTransition}
              className="max-w-2xl mx-auto w-full"
            >
              <FillerQuestionScreen
                question={{
                  ...currentQuestion,
                  title: personalizedText(currentQuestion.title),
                  description: personalizedText(currentQuestion.description),
                }}
                questionIndex={state.currentIndex}
                totalQuestions={questions.length}
                answer={state.answers[currentQuestion.id] || ''}
                onAnswerChange={(val) => setAnswer(currentQuestion.id, val)}
                onAdvance={goNext}
                theme={theme}
                showQuestionNumbers={state.form.showQuestionNumbers}
              />
            </motion.div>
          )}

          {/* Submitting Screen */}
          {state.screen === 'submitting' && (
            <motion.div
              key="submitting"
              custom={state.direction}
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="max-w-2xl mx-auto w-full text-center"
            >
              <div className="flex flex-col items-center gap-4">
                <Loader2
                  className="size-12 animate-spin"
                  style={{ color: theme.buttonColor }}
                />
                <p className={`text-xl ${ff}`} style={{ color: theme.textColor }}>
                  Submitting your response...
                </p>
              </div>
            </motion.div>
          )}

          {/* Ending Screen */}
          {state.screen === 'ending' && (
            <motion.div
              key="ending"
              custom={state.direction}
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-2xl mx-auto w-full text-center"
            >
              <motion.div
                variants={checkmarkVariants}
                initial="hidden"
                animate="visible"
                className="mx-auto mb-8 size-24 rounded-full flex items-center justify-center relative"
                style={{ backgroundColor: theme.buttonColor }}
              >
                {/* Golden glow behind checkmark */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    boxShadow: `0 12px 28px ${theme.buttonColor}55`,
                  }}
                />
                <Check className="size-12 relative z-10" style={{ color: theme.buttonTextColor }} />
              </motion.div>
              <h1
                className={`text-4xl md:text-5xl font-bold mb-4 ${ff}`}
                style={{ color: theme.textColor }}
              >
                {personalizedText(state.activeEnding?.title || state.form.endingTitle || 'Thank you!')}
              </h1>
              <p
                className={`text-lg md:text-xl ${ff}`}
                style={{ color: theme.textSecondaryColor }}
              >
                {personalizedText(state.activeEnding?.message || state.form.endingMessage || 'Your response has been recorded.')}
              </p>

              {/* Show redirect link if custom ending has one */}
              {state.activeEnding?.redirectUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6"
                >
                  <a
                    href={state.activeEnding.redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </a>
                </motion.div>
              )}

              {/* Preview mode indicator */}
              {!shareMode && !state.form.published && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className={`text-sm mt-4 ${ff}`}
                  style={{ color: theme.textTertiaryColor }}
                >
                  Preview — No data was saved
                </motion.p>
              )}

              {/* Keep the completion action visually identical in public and preview modes. */}
              <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8"
                >
                  <button
                    onClick={handleSubmitAnother}
                    className="inline-flex min-h-11 items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90 active:scale-95 border-2"
                    style={{ borderColor: theme.fieldBorderColor, color: theme.textColor, backgroundColor: theme.controlSurfaceColor }}
                  >
                    <RotateCcw className="size-4" />
                    {shareMode ? 'Submit another response' : 'Start another preview'}
                  </button>
                </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="filler-bottom-bar absolute bottom-0 left-0 right-0 px-6 sm:px-8 md:px-16 lg:px-24 py-4 md:py-6 flex items-center justify-between z-20">
        {/* Back button + connection indicator */}
        <div className="flex items-center gap-4 min-w-[80px]">
          {state.form.allowBackNavigation &&
            (state.screen === 'question' || state.screen === 'ending') && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={goBack}
                className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium transition-all hover:opacity-80"
                style={{ color: theme.textSecondaryColor }}
                whileTap={{ scale: 0.97 }}
              >
                <ArrowLeft className="size-4" />
                Back
              </motion.button>
            )}
          {/* Connection indicator (live dot) */}
          {state.screen === 'question' && (
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor: state.draftSaveStatus === 'error' ? theme.errorColor : state.draftSaveStatus === 'saving' ? theme.accentTextColor : theme.successColor,
                }}
              />
              <span className="text-xs" style={{ color: state.draftSaveStatus === 'error' ? theme.errorColor : theme.textTertiaryColor }}>
                {state.draftSaveStatus === 'error' ? 'Draft save needs attention' : state.draftSaveStatus === 'saving' ? 'Saving draft…' : 'Saved locally'}
              </span>
            </div>
          )}
        </div>

        {/* Welcome: Start button | Question: OK button */}
        <div className="min-w-[80px] flex justify-end">
          {state.screen === 'welcome' && (
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              onClick={goNext}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-base font-medium transition-all hover:opacity-90"
              whileTap={{ scale: 0.97 }}
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
            >
              Start
              <ArrowRight className="size-4" />
            </motion.button>
          )}

          {state.screen === 'question' && currentQuestion && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              onClick={goNext}
              className="inline-flex min-h-11 items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90"
              whileTap={{ scale: 0.97 }}
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
            >
              OK
              <Check className="size-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* ── "Powered by Forms" branding (share mode) ── */}
      {shareMode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 hidden sm:block">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className={`text-xs ${ff} flex items-center gap-1`}
            style={{ color: theme.textTertiaryColor }}
          >
            Powered by <BrandMark className="size-4" title="Forms" /><span className="font-semibold">Forms</span>
          </motion.p>
        </div>
      )}

      {/* ── Keyboard shortcut hints ── */}
      {state.screen === 'question' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 hidden sm:block">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className={`text-xs ${ff}`}
            style={{ color: theme.textTertiaryColor }}
          >
            press <strong>Enter ↵</strong> to continue · <strong>← Backspace</strong> to go back
          </motion.p>
        </div>
      )}

      {state.screen === 'welcome' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 hidden sm:block">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className={`text-xs ${ff}`}
            style={{ color: theme.textTertiaryColor }}
          >
            press <strong>Enter ↵</strong>
          </motion.p>
        </div>
      )}
    </div>
  );
}
