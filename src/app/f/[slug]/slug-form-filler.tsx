'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Form, FormEnding, FormQuestion, LogicRule } from '@/types/form';
import { QuestionInput } from '@/components/forms/question-input';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { CONFETTI_COLORS, STAR_COLORS } from '@/lib/constants';

/* ─── Confetti particle ────────────────────────────────────────────────── */

function ConfettiParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => {
      const isStar = i < 6;
      return {
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 2 + Math.random() * 2,
        color: isStar
          ? STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
          : CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: isStar ? 8 + Math.random() * 8 : 4 + Math.random() * 6,
        rotation: Math.random() * 360,
        drift: (Math.random() - 0.5) * 40,
        isCircle: !isStar && Math.random() > 0.5,
        isStar,
      };
    }),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-30">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: `${p.x}vw`,
            y: '-5vh',
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            y: '105vh',
            x: `calc(${p.x}vw + ${p.drift}px)`,
            rotate: p.rotation + 720,
            opacity: [1, 1, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="absolute"
          style={{ width: p.size, height: p.size }}
        >
          {p.isStar ? (
            <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ filter: `drop-shadow(0 0 3px ${p.color})` }}>
              <path
                d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"
                fill={p.color}
              />
            </svg>
          ) : (
            <div
              className={p.isCircle ? 'rounded-full' : 'rounded-sm'}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: p.color,
              }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type FillerScreen = 'welcome' | 'question' | 'ending' | 'submitting' | 'error' | 'not-found' | 'not-published';

interface FillerState {
  form: Form | null;
  screen: FillerScreen;
  currentIndex: number;
  answers: Record<string, string>;
  direction: 1 | -1;
  isLoading: boolean;
  errorMessage: string;
  activeEnding: FormEnding | null;
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

const questionTransition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
};

const fadeVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const checkmarkVariants = {
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

export function SlugFormFiller({ form: initialForm }: { form: Form }) {
  const [showConfetti, setShowConfetti] = useState(false);

  const [state, setState] = useState<FillerState>({
    form: initialForm,
    screen: 'welcome',
    currentIndex: -1,
    answers: {},
    direction: 1,
    isLoading: false,
    errorMessage: '',
    activeEnding: null,
  });

  // Auto-hide confetti after animation
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Reset form for "Submit another response"
  const handleSubmitAnother = useCallback(() => {
    setState((prev) => ({
      ...prev,
      form: prev.form,
      screen: 'welcome' as const,
      currentIndex: -1,
      answers: {},
      direction: 1 as const,
      isLoading: false,
      errorMessage: '',
    }));
  }, []);

  // Sorted questions (exclude ending type)
  const questions = useMemo(() => {
    if (!state.form) return [];
    return state.form.questions
      .filter((q) => q.type !== 'ending')
      .sort((a, b) => a.order - b.order);
  }, [state.form]);

  const currentQuestion = useMemo(() => {
    if (state.currentIndex < 0 || state.currentIndex >= questions.length) return null;
    return questions[state.currentIndex];
  }, [state.currentIndex, questions]);

  // ── Submit ──
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
    const currentAnswers = answersRef.current;
    if (!currentForm) return;

    setState((s) => ({ ...s, screen: 'submitting', direction: 1 }));

    const answerList = Object.entries(currentAnswers).map(([questionId, value]) => ({
      questionId,
      value,
    }));

    try {
      const res = await fetch(`/api/forms/${currentForm.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answerList,
          metadata: {
            submittedAt: new Date().toISOString(),
          },
        }),
      });

      if (res.ok) {
        setState((s) => ({ ...s, screen: 'ending', direction: 1 }));
        setShowConfetti(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setState((s) => ({
          ...s,
          screen: 'error',
          errorMessage: data.error || 'Something went wrong submitting your response.',
        }));
      }
    } catch {
      setState((s) => ({
        ...s,
        screen: 'error',
        errorMessage: 'Network error. Please check your connection and try again.',
      }));
    }
  }, []);

  const handleSubmitWithEnding = useCallback(async (endingId: string) => {
    const currentForm = formRef.current;
    const currentAnswers = answersRef.current;
    if (!currentForm) return;

    setState((s) => ({ ...s, screen: 'submitting', direction: 1 }));

    const answerList = Object.entries(currentAnswers).map(([questionId, value]) => ({
      questionId,
      value,
    }));

    try {
      const res = await fetch(`/api/forms/${currentForm.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answerList,
          metadata: { submittedAt: new Date().toISOString() },
        }),
      });

      if (res.ok) {
        // Find the target ending; fall back to default form ending fields if not found
        const targetEnding = endingId && endingId !== '__default__'
          ? currentForm.endings?.find((e) => e.id === endingId) ?? null
          : null;

        setState((s) => ({
          ...s,
          screen: 'ending',
          direction: 1,
          activeEnding: targetEnding,
        }));
        setShowConfetti(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setState((s) => ({
          ...s,
          screen: 'error',
          errorMessage: data.error || 'Something went wrong submitting your response.',
        }));
      }
    } catch {
      setState((s) => ({
        ...s,
        screen: 'error',
        errorMessage: 'Network error. Please check your connection and try again.',
      }));
    }
  }, []);

  // ── Logic Evaluation ──

  const evaluateLogicRule = useCallback((
    rule: LogicRule,
    question: FormQuestion,
    answer: string
  ): boolean => {
    const { condition } = rule;
    const { operator, value: conditionValue, field } = condition;

    // is_filled and is_empty operators work for all question types
    if (operator === 'is_filled') {
      return !!answer && answer.trim() !== '';
    }
    if (operator === 'is_empty') {
      return !answer || answer.trim() === '';
    }

    // For choice questions
    if (['multiple_choice', 'picture_choice', 'dropdown'].includes(question.type)) {
      const selectedIds = answer.split(',').map((s: string) => s.trim());
      if (operator === 'equals') {
        return selectedIds.includes(field) && selectedIds.length === 1;
      }
      if (operator === 'not_equals') {
        return !selectedIds.includes(field);
      }
      return false;
    }

    if (question.type === 'yes_no') {
      const isYes = answer.toLowerCase() === 'yes' || answer === 'true';
      const isNo = answer.toLowerCase() === 'no' || answer === 'false';
      if (operator === 'equals') {
        if (field === 'yes') return isYes;
        if (field === 'no') return isNo;
        return answer.toLowerCase() === conditionValue.toLowerCase();
      }
      if (operator === 'not_equals') {
        if (field === 'yes') return !isYes;
        if (field === 'no') return !isNo;
        return answer.toLowerCase() !== conditionValue.toLowerCase();
      }
      return false;
    }

    if (['rating', 'opinion_scale', 'number'].includes(question.type)) {
      const numAnswer = parseFloat(answer);
      const numCondition = parseFloat(conditionValue);
      if (isNaN(numAnswer) || isNaN(numCondition)) return false;
      switch (operator) {
        case 'equals': return numAnswer === numCondition;
        case 'not_equals': return numAnswer !== numCondition;
        case 'greater_than': return numAnswer > numCondition;
        case 'less_than': return numAnswer < numCondition;
        default: return false;
      }
    }

    // Text-based questions
    switch (operator) {
      case 'equals': return answer.toLowerCase() === conditionValue.toLowerCase();
      case 'not_equals': return answer.toLowerCase() !== conditionValue.toLowerCase();
      case 'contains': return answer.toLowerCase().includes(conditionValue.toLowerCase());
      default: return false;
    }
  }, []);

  // ── Navigation ──

  const goNext = useCallback(() => {
    if (state.screen === 'welcome') {
      if (questions.length === 0) {
        setState((s) => ({ ...s, screen: 'ending', direction: 1 }));
        setShowConfetti(true);
      } else {
        setState((s) => ({ ...s, screen: 'question', currentIndex: 0, direction: 1 }));
      }
      return;
    }

    if (state.screen === 'question') {
      const currentAnswers = answersRef.current;
      if (currentQuestion?.required) {
        const answer = currentAnswers[currentQuestion.id];
        if (!answer || answer.trim() === '') {
          return;
        }
      }

      // Evaluate logic rules
      if (currentQuestion && (currentQuestion.logic?.length > 0 || currentQuestion.settings?.jumpToQuestionId)) {
        const currentAnswer = currentAnswers[currentQuestion.id] || '';

        for (const rule of currentQuestion.logic || []) {
          if (evaluateLogicRule(rule, currentQuestion, currentAnswer)) {
            // Handle show_ending action
            if (rule.action.type === 'show_ending') {
              handleSubmitWithEnding(rule.action.targetQuestionId);
              return;
            }

            const targetId = rule.action.targetQuestionId;

            if (targetId === '__submit__') {
              handleSubmit();
              return;
            }

            const targetIndex = questions.findIndex((q) => q.id === targetId);
            if (targetIndex !== -1) {
              setState((s) => ({
                ...s,
                currentIndex: targetIndex,
                direction: 1,
              }));
              return;
            }
          }
        }

        const jumpToQuestionId = currentQuestion.settings?.jumpToQuestionId;
        if (jumpToQuestionId) {
          if (jumpToQuestionId === '__submit__') {
            handleSubmit();
            return;
          }

          const targetIndex = questions.findIndex((q) => q.id === jumpToQuestionId);
          if (targetIndex !== -1) {
            setState((s) => ({
              ...s,
              currentIndex: targetIndex,
              direction: 1,
            }));
            return;
          }
        }
      }

      // Default behavior
      if (state.currentIndex < questions.length - 1) {
        setState((s) => ({
          ...s,
          currentIndex: s.currentIndex + 1,
          direction: 1,
        }));
      } else {
        handleSubmit();
      }
    }
  }, [state.screen, state.currentIndex, questions, currentQuestion, handleSubmit, handleSubmitWithEnding, evaluateLogicRule]);

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

  // ── Answer handler ──

  const setAnswer = useCallback((questionId: string, value: string) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: value },
    }));
  }, []);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        if (!isInput) {
          e.preventDefault();
          goNext();
        }
      }

      if (e.key === 'Backspace' && !isInput) {
        e.preventDefault();
        goBack();
      }

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goBack]);

  // ── Progress calculation ──

  const progress = useMemo(() => {
    if (state.screen === 'welcome') return 0;
    if (state.screen === 'ending' || state.screen === 'submitting') return 100;
    if (questions.length === 0) return 0;
    return ((state.currentIndex + 1) / questions.length) * 100;
  }, [state.screen, state.currentIndex, questions.length]);

  // ── Theme ──

  const theme = useMemo(() => {
    if (!state.form) {
      return {
        backgroundColor: '#FFFFFF',
        textColor: '#333333',
        buttonColor: '#1A1A1A',
        buttonTextColor: '#FFFFFF',
        fontFamily: 'sans',
      };
    }
    return {
      backgroundColor: state.form.backgroundColor,
      textColor: state.form.textColor,
      buttonColor: state.form.buttonColor,
      buttonTextColor: state.form.buttonTextColor,
      fontFamily: state.form.fontFamily,
    };
  }, [state.form]);

  const ff = fontFamilyClass(theme.fontFamily);

  if (!state.form) return null;

  const screenKey = state.screen === 'question'
    ? `question-${state.currentIndex}`
    : state.screen;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {/* ── Confetti ── */}
      {showConfetti && state.screen === 'ending' && <ConfettiParticles />}

      {/* ── Progress Bar ── */}
      {state.form.progressbar && (
        <div className="absolute top-0 left-0 right-0 h-1.5 z-30" style={{ backgroundColor: `${theme.textColor}10` }}>
          <motion.div
            className="h-full relative progress-bar-glow"
            style={{
              backgroundColor: theme.buttonColor,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 size-3 rounded-full border-2"
              style={{
                backgroundColor: theme.buttonColor,
                borderColor: theme.backgroundColor,
                boxShadow: `0 0 6px ${theme.buttonColor}66`,
              }}
            />
          </motion.div>
        </div>
      )}

      {/* ── Close button ── */}
      {state.screen !== 'ending' && (
        <button
          onClick={() => window.close()}
          className="absolute top-4 right-4 z-30 size-10 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
          style={{ backgroundColor: `${theme.textColor}10`, color: theme.textColor }}
          aria-label="Close form"
        >
          <X className="size-5" />
        </button>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 pb-20 relative overflow-hidden">
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
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                  className={`text-4xl md:text-6xl font-bold leading-tight ${ff}`}
                  style={{ color: theme.textColor }}
                >
                  {state.form.welcomeTitle || state.form.title || 'Welcome!'}
                  <span
                    className="inline-block w-0.5 h-[0.8em] ml-1 align-middle rounded-sm animate-[blink_1s_step-end_infinite]"
                    style={{ backgroundColor: theme.textColor }}
                  />
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 0.6, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
                  className={`text-lg md:text-xl ${ff}`}
                  style={{ color: theme.textColor }}
                >
                  {state.form.welcomeMessage || 'Thanks for taking the time to fill this out.'}
                </motion.p>
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
              <SlugQuestionScreen
                question={currentQuestion}
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
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    boxShadow: `0 0 40px 10px ${theme.buttonColor}66, 0 0 80px 20px ${theme.buttonColor}33`,
                  }}
                />
                <Check className="size-12 relative z-10" style={{ color: theme.buttonTextColor }} />
              </motion.div>
              <h1
                className={`text-4xl md:text-5xl font-bold mb-4 ${ff}`}
                style={{ color: theme.textColor }}
              >
                {state.activeEnding?.title || state.form.endingTitle || 'Thank you!'}
              </h1>
              <p
                className={`text-lg md:text-xl opacity-60 ${ff}`}
                style={{ color: theme.textColor }}
              >
                {state.activeEnding?.message || state.form.endingMessage || 'Your response has been recorded.'}
              </p>
              {state.activeEnding?.redirectUrl && (
                <a
                  href={state.activeEnding.redirectUrl}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, boxShadow: `0 4px 14px ${theme.buttonColor}40` }}
                >
                  Continue
                  <ArrowRight className="size-4" />
                </a>
              )}

              {/* Submit another response button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <button
                  onClick={handleSubmitAnother}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90 active:scale-95 border-2"
                  style={{ borderColor: `${theme.textColor}20`, color: theme.textColor, backgroundColor: 'transparent' }}
                >
                  <RotateCcw className="size-4" />
                  Submit another response
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Error Screen */}
          {state.screen === 'error' && (
            <motion.div
              key="error"
              custom={state.direction}
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="max-w-2xl mx-auto w-full text-center"
            >
              <div className="flex flex-col items-center gap-4">
                <X className="size-16 opacity-30" style={{ color: '#ef4444' }} />
                <h2 className={`text-2xl font-bold ${ff}`} style={{ color: theme.textColor }}>
                  Something went wrong
                </h2>
                <p className={`text-base opacity-60 ${ff}`} style={{ color: theme.textColor }}>
                  {state.errorMessage}
                </p>
                <button
                  onClick={() => setState((s) => ({ ...s, screen: 'welcome', direction: -1 }))}
                  className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
                  style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
                >
                  <RotateCcw className="size-4" />
                  Try again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="absolute bottom-0 left-0 right-0 px-8 md:px-16 lg:px-24 py-4 md:py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-4 min-w-[80px]">
          {state.form.allowBackNavigation &&
            (state.screen === 'question' || state.screen === 'ending') && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={goBack}
                className="flex items-center gap-2 text-sm font-medium opacity-50 hover:opacity-100 transition-all"
                style={{ color: theme.textColor }}
                whileTap={{ scale: 0.97 }}
              >
                <ArrowLeft className="size-4" />
                Back
              </motion.button>
            )}
          {state.screen === 'question' && (
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green-500 live-dot-pulse" />
              <span className="text-[10px] opacity-30" style={{ color: theme.textColor }}>Live</span>
            </div>
          )}
        </div>

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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90"
              whileTap={{ scale: 0.97 }}
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
            >
              OK
              <Check className="size-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* ── "Powered by Forms" branding ── */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ delay: 1 }}
          className={`text-xs ${ff} flex items-center gap-1`}
          style={{ color: theme.textColor }}
        >
          Powered by <span className="font-semibold">Forms</span>
        </motion.p>
      </div>

      {/* ── Keyboard shortcut hints ── */}
      {state.screen === 'question' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1 }}
            className={`text-xs ${ff}`}
            style={{ color: theme.textColor }}
          >
            press <strong>Enter ↵</strong> to continue · <strong>← Backspace</strong> to go back
          </motion.p>
        </div>
      )}

      {state.screen === 'welcome' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1.5 }}
            className={`text-xs ${ff}`}
            style={{ color: theme.textColor }}
          >
            press <strong>Enter ↵</strong>
          </motion.p>
        </div>
      )}
    </div>
  );
}

/* ─── Question Screen Sub-component ──────────────────────────────────── */

function SlugQuestionScreen({
  question,
  questionIndex,
  totalQuestions,
  answer,
  onAnswerChange,
  onAdvance,
  theme,
  showQuestionNumbers,
}: {
  question: FormQuestion;
  questionIndex: number;
  totalQuestions: number;
  answer: string;
  onAnswerChange: (value: string) => void;
  onAdvance: () => void;
  theme: {
    backgroundColor: string;
    textColor: string;
    buttonColor: string;
    buttonTextColor: string;
    fontFamily: string;
  };
  showQuestionNumbers: boolean;
}) {
  const ff = fontFamilyClass(theme.fontFamily);

  return (
    <div className="space-y-6">
      {/* Question number + required indicator */}
      <div className="flex items-center gap-3">
        {showQuestionNumbers && (
          <span
            className={`text-xs font-semibold uppercase tracking-wider opacity-50 ${ff}`}
            style={{ color: theme.textColor }}
          >
            {questionIndex + 1} ↦ {totalQuestions}
          </span>
        )}
        {question.required && (
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${ff}`}
            style={{ color: theme.buttonColor }}
          >
            Required
          </span>
        )}
      </div>

      {/* Title */}
      <h2
        className={`text-2xl md:text-4xl font-bold leading-snug ${ff}`}
        style={{ color: theme.textColor }}
      >
        {question.title}
      </h2>

      {/* Description */}
      {question.description && (
        <p
          className={`text-base md:text-lg opacity-50 ${ff}`}
          style={{ color: theme.textColor }}
        >
          {question.description}
        </p>
      )}

      {/* Input */}
      <div className="pt-2">
        <QuestionInput
          question={question}
          value={answer}
          onChange={onAnswerChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={true}
        />
      </div>
    </div>
  );
}
