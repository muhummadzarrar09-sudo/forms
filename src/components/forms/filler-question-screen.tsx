'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FormQuestion, FormTheme } from '@/types/form';
import { QuestionInput } from '@/components/forms/question-input';
import { requiredAnswerIsSatisfied } from '@/lib/filler-navigation';

interface FillerQuestionScreenProps {
  question: FormQuestion;
  questionIndex: number;
  totalQuestions: number;
  answer: string;
  onAnswerChange: (value: string) => void;
  onAdvance: () => void;
  theme: FormTheme;
  showQuestionNumbers: boolean;
}

function fontFamilyClass(fontFamily: string) {
  return fontFamily === 'serif' ? 'font-serif' : fontFamily === 'mono' ? 'font-mono' : 'font-sans';
}

/** Shared question presentation for public and in-app filler shells. */
export function FillerQuestionScreen({
  question,
  questionIndex,
  totalQuestions,
  answer,
  onAnswerChange,
  onAdvance,
  theme,
  showQuestionNumbers,
}: FillerQuestionScreenProps) {
  const fontClass = fontFamilyClass(theme.fontFamily);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [attemptedEmpty, setAttemptedEmpty] = useState(false);

  // Announce each navigated question to keyboard and screen-reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [question.id]);
  const showRequiredHint = attemptedEmpty && !requiredAnswerIsSatisfied(question, answer);

  const handleAdvance = useCallback(() => {
    if (!requiredAnswerIsSatisfied(question, answer)) {
      setAttemptedEmpty(true);
      return;
    }
    setAttemptedEmpty(false);
    onAdvance();
  }, [question, answer, onAdvance]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {showQuestionNumbers && (
          <span className={`text-xs font-semibold uppercase tracking-wider opacity-50 ${fontClass}`} style={{ color: theme.textColor }}>
            {questionIndex + 1} ↦ {totalQuestions}
          </span>
        )}
        {question.required && (
          <span className={`text-xs font-semibold uppercase tracking-wider ${fontClass}`} style={{ color: theme.buttonColor }}>
            Required
          </span>
        )}
      </div>

      <h2 ref={headingRef} tabIndex={-1} className={`text-2xl md:text-4xl font-bold leading-snug outline-none ${fontClass}`} style={{ color: theme.textColor }}>
        {question.title}
      </h2>

      {question.description && (
        <p className={`text-base md:text-lg opacity-50 ${fontClass}`} style={{ color: theme.textColor }}>
          {question.description}
        </p>
      )}

      <div className="pt-2">
        <QuestionInput
          question={question}
          value={answer}
          onChange={onAnswerChange}
          onAdvance={handleAdvance}
          theme={theme}
          isActive
        />
      </div>

      <AnimatePresence>
        {showRequiredHint && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            role="alert"
            className="text-sm font-medium"
            style={{ color: theme.buttonColor }}
          >
            This question requires an answer
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
