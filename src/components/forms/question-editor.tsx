'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FormQuestion, QuestionType, QuestionOption } from '@/types/form';
import { useFormStore } from '@/store/form-store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Star,
  ChevronDown,
  ThumbsUp,
  Calendar,
  Plus,
  X,
  ArrowRight,
  ImageIcon,
  Eye,
  EyeOff,
} from 'lucide-react';

interface QuestionEditorProps {
  question: FormQuestion;
  questionIndex: number;
  totalQuestions: number;
  formBackgroundColor?: string;
  formTextColor?: string;
  formButtonColor?: string;
  formButtonTextColor?: string;
  formFontFamily?: string;
}

export function QuestionEditor({
  question,
  questionIndex,
  totalQuestions,
  formBackgroundColor = '#FFFFFF',
  formTextColor = '#333333',
  formButtonColor = '#1A1A1A',
  formButtonTextColor = '#FFFFFF',
  formFontFamily = 'sans',
}: QuestionEditorProps) {
  const { updateQuestion, currentForm } = useFormStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(() => question.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descValue, setDescValue] = useState(() => question.description);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [optionText, setOptionText] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedScale, setSelectedScale] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const handleTitleSave = useCallback(() => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== question.title) {
      updateQuestion(question.id, { title: trimmed });
    } else {
      setTitleValue(question.title);
    }
    setIsEditingTitle(false);
  }, [titleValue, question.title, question.id, updateQuestion]);

  const handleDescriptionSave = useCallback(() => {
    const trimmed = descValue.trim();
    if (trimmed !== question.description) {
      updateQuestion(question.id, { description: trimmed });
    }
    setIsEditingDescription(false);
  }, [descValue, question.description, question.id, updateQuestion]);

  const handleOptionUpdate = useCallback(
    (optionId: string, newLabel: string) => {
      const newOptions = question.options.map((opt) =>
        opt.id === optionId ? { ...opt, label: newLabel } : opt
      );
      updateQuestion(question.id, { options: newOptions });
      setEditingOptionId(null);
    },
    [question.options, question.id, updateQuestion]
  );

  const handleAddOption = useCallback(() => {
    const newOption: QuestionOption = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      label: `Option ${question.options.length + 1}`,
    };
    updateQuestion(question.id, { options: [...question.options, newOption] });
  }, [question.options, question.id, updateQuestion]);

  const handleRemoveOption = useCallback(
    (optionId: string) => {
      if (question.options.length <= 1) return;
      updateQuestion(question.id, {
        options: question.options.filter((opt) => opt.id !== optionId),
      });
    },
    [question.options, question.id, updateQuestion]
  );

  const fontFamilyClass =
    formFontFamily === 'serif'
      ? 'font-serif'
      : formFontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* ── Live Preview Section ── */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPreview ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>

        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div
                className="relative rounded-xl border shadow-sm overflow-hidden max-h-[320px]"
                style={{ borderColor: `${formTextColor}15` }}
              >
                {/* Preview badge */}
                <div className="absolute top-2 right-2 z-10">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 bg-black/40 text-white backdrop-blur-sm border-0"
                  >
                    Preview
                  </Badge>
                </div>

                <div
                  className="px-6 py-5"
                  style={{ backgroundColor: formBackgroundColor, color: formTextColor }}
                >
                  {/* Question number */}
                  <span
                    className="text-xs font-medium opacity-50"
                    style={{ color: formTextColor }}
                  >
                    {questionIndex + 1} of {totalQuestions}
                  </span>

                  {/* Title */}
                  <h3
                    className={`text-lg font-bold mt-1 leading-snug ${fontFamilyClass}`}
                    style={{ color: formTextColor }}
                  >
                    {question.title || 'Untitled question'}
                    {question.required && question.type !== 'statement' && question.type !== 'ending' && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </h3>

                  {/* Description */}
                  {question.description && question.type !== 'yes_no' && question.type !== 'rating' && question.type !== 'opinion_scale' && (
                    <p
                      className={`text-sm opacity-60 mt-1 ${fontFamilyClass}`}
                      style={{ color: formTextColor }}
                    >
                      {question.description}
                    </p>
                  )}

                  {/* Mini input preview */}
                  <div className="mt-3">
                    <MiniQuestionPreview
                      question={question}
                      formTextColor={formTextColor}
                      formButtonColor={formButtonColor}
                      formButtonTextColor={formButtonTextColor}
                      fontFamilyClass={fontFamilyClass}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Editor Section ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 md:px-12 py-10 relative overflow-hidden"
        style={{ backgroundColor: formBackgroundColor, color: formTextColor }}
      >
        <div className="w-full max-w-2xl space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-5"
            >
              {/* Question number + Required indicator row */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium opacity-50"
                  style={{ color: formTextColor }}
                >
                  {questionIndex + 1} of {totalQuestions}
                </span>
                {question.required && question.type !== 'statement' && question.type !== 'ending' && (
                  <span className="text-xs font-medium opacity-50 uppercase tracking-wider">
                    Required
                  </span>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                {isEditingTitle ? (
                  <textarea
                    ref={titleRef}
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleTitleSave();
                      }
                      if (e.key === 'Escape') {
                        setTitleValue(question.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    className={`w-full bg-transparent border-b-2 border-current/30 focus:border-current outline-none text-3xl md:text-4xl font-bold resize-none leading-tight ${fontFamilyClass}`}
                    style={{ color: formTextColor }}
                    rows={2}
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => setIsEditingTitle(true)}
                    className={`text-3xl md:text-4xl font-bold leading-tight cursor-text hover:opacity-90 transition-opacity ${fontFamilyClass}`}
                    style={{ color: formTextColor }}
                    title="Click to edit"
                  >
                    {question.title || 'Untitled question'}
                  </h2>
                )}

                {/* Description */}
                {question.type !== 'yes_no' &&
                  question.type !== 'rating' &&
                  question.type !== 'opinion_scale' && (
                    <div>
                      {isEditingDescription ? (
                        <textarea
                          ref={descRef}
                          value={descValue}
                          onChange={(e) => setDescValue(e.target.value)}
                          onBlur={handleDescriptionSave}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setDescValue(question.description);
                              setIsEditingDescription(false);
                            }
                          }}
                          className={`w-full bg-transparent border-b border-current/20 focus:border-current/40 outline-none text-lg resize-none ${fontFamilyClass}`}
                          style={{ color: formTextColor }}
                          rows={2}
                          placeholder="Add a description..."
                          autoFocus
                        />
                      ) : (
                        <p
                          onClick={() => setIsEditingDescription(true)}
                          className={`text-lg opacity-70 cursor-text hover:opacity-90 transition-opacity ${fontFamilyClass}`}
                          style={{ color: formTextColor }}
                        >
                          {question.description || (
                            <span className="italic opacity-50">Add a description...</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
              </div>

              {/* Question type specific input area */}
              <div className="min-h-[60px]">
                <QuestionTypePreview
                  question={question}
                  formTextColor={formTextColor}
                  formButtonColor={formButtonColor}
                  formButtonTextColor={formButtonTextColor}
                  fontFamilyClass={fontFamilyClass}
                  editingOptionId={editingOptionId}
                  optionText={optionText}
                  setEditingOptionId={setEditingOptionId}
                  setOptionText={setOptionText}
                  handleOptionUpdate={handleOptionUpdate}
                  handleAddOption={handleAddOption}
                  handleRemoveOption={handleRemoveOption}
                  hoveredRating={hoveredRating}
                  setHoveredRating={setHoveredRating}
                  selectedScale={selectedScale}
                  setSelectedScale={setSelectedScale}
                  updateQuestion={updateQuestion}
                />
              </div>

              {/* OK button (Typeform style) */}
              {question.type !== 'statement' && question.type !== 'ending' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-3 mt-2"
                >
                  <Button
                    size="default"
                    className="gap-2 rounded-full px-6 h-10 text-sm font-medium"
                    style={{
                      backgroundColor: formButtonColor,
                      color: formButtonTextColor,
                    }}
                  >
                    OK
                    <CheckCircle2 className="size-4" />
                  </Button>
                  <span
                    className="text-xs opacity-40"
                    style={{ color: formTextColor }}
                  >
                    press <strong>Enter ↵</strong>
                  </span>
                </motion.div>
              )}

              {/* Statement / Ending continue button */}
              {(question.type === 'statement' || question.type === 'ending') && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2"
                >
                  <Button
                    size="default"
                    className="gap-2 rounded-full px-6 h-10 text-sm font-medium"
                    style={{
                      backgroundColor: formButtonColor,
                      color: formButtonTextColor,
                    }}
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Mini Question Preview (Visual only, no interaction) ──────────────────── */

function MiniQuestionPreview({
  question,
  formTextColor,
  formButtonColor,
  formButtonTextColor,
  fontFamilyClass,
}: {
  question: FormQuestion;
  formTextColor: string;
  formButtonColor: string;
  formButtonTextColor: string;
  fontFamilyClass: string;
}) {
  const type = question.type;

  // Short Text / Email / Phone / Website
  if (type === 'short_text' || type === 'email' || type === 'phone' || type === 'website') {
    const placeholders: Record<string, string> = {
      short_text: 'Type your answer here...',
      email: 'name@example.com',
      phone: '+1 (555) 000-0000',
      website: 'https://example.com',
    };
    return (
      <div
        className={`text-sm opacity-40 border-b pb-1 ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}30` }}
      >
        {question.placeholder || placeholders[type] || 'Type your answer...'}
      </div>
    );
  }

  // Long Text
  if (type === 'long_text') {
    return (
      <div
        className={`text-sm opacity-40 border-b pb-1 ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}30` }}
      >
        {question.placeholder || 'Type your answer here...'}
      </div>
    );
  }

  // Multiple Choice / Picture Choice
  if (type === 'multiple_choice' || type === 'picture_choice') {
    const maxOptions = 4;
    const displayOptions = question.options.slice(0, maxOptions);
    return (
      <div className="space-y-1.5">
        {displayOptions.map((option) => (
          <div
            key={option.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
            style={{ borderColor: `${formTextColor}18`, backgroundColor: `${formTextColor}05` }}
          >
            <div
              className="size-3.5 rounded-full border shrink-0"
              style={{ borderColor: `${formTextColor}40` }}
            />
            <span className={`text-xs truncate ${fontFamilyClass}`} style={{ color: formTextColor }}>
              {option.label}
            </span>
          </div>
        ))}
        {question.options.length > maxOptions && (
          <span className="text-xs opacity-40 ml-1" style={{ color: formTextColor }}>
            +{question.options.length - maxOptions} more
          </span>
        )}
      </div>
    );
  }

  // Dropdown
  if (type === 'dropdown') {
    return (
      <div
        className="flex items-center justify-between px-3 py-1.5 rounded-md border"
        style={{ borderColor: `${formTextColor}18`, backgroundColor: `${formTextColor}05` }}
      >
        <span className={`text-xs opacity-40 ${fontFamilyClass}`} style={{ color: formTextColor }}>
          Select an option...
        </span>
        <ChevronDown className="size-3.5 opacity-40" style={{ color: formTextColor }} />
      </div>
    );
  }

  // Yes/No
  if (type === 'yes_no') {
    return (
      <div className="flex gap-2">
        <div
          className="flex-1 py-2 rounded-lg border flex items-center justify-center gap-1.5"
          style={{ borderColor: `${formTextColor}20` }}
        >
          <ThumbsUp className="size-3.5" style={{ color: formTextColor }} />
          <span className={`text-xs font-semibold ${fontFamilyClass}`} style={{ color: formTextColor }}>
            Yes
          </span>
        </div>
        <div
          className="flex-1 py-2 rounded-lg border flex items-center justify-center gap-1.5"
          style={{ borderColor: `${formTextColor}20` }}
        >
          <ThumbsUp className="size-3.5 rotate-180" style={{ color: formTextColor }} />
          <span className={`text-xs font-semibold ${fontFamilyClass}`} style={{ color: formTextColor }}>
            No
          </span>
        </div>
      </div>
    );
  }

  // Rating
  if (type === 'rating') {
    const steps = question.settings?.steps || 5;
    return (
      <div className="flex gap-1">
        {Array.from({ length: steps }, (_, i) => i + 1).map((step) => (
          <Star
            key={step}
            className="size-5"
            style={{ color: `${formTextColor}25`, fill: 'transparent' }}
          />
        ))}
      </div>
    );
  }

  // Opinion Scale
  if (type === 'opinion_scale') {
    const steps = question.settings?.steps || 10;
    const startAtOne = question.settings?.startAtOne ?? false;
    const start = startAtOne ? 1 : 0;
    const end = startAtOne ? steps : steps - 1;
    return (
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map((val) => (
          <div
            key={val}
            className="size-7 rounded border flex items-center justify-center text-xs font-semibold"
            style={{ borderColor: `${formTextColor}20`, color: formTextColor }}
          >
            {val}
          </div>
        ))}
      </div>
    );
  }

  // Number
  if (type === 'number') {
    return (
      <div
        className={`text-sm opacity-40 border-b pb-1 ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}30` }}
      >
        {question.placeholder || 'Type a number...'}
      </div>
    );
  }

  // Date
  if (type === 'date') {
    return (
      <div
        className="flex items-center gap-2 border-b pb-1"
        style={{ borderBottomColor: `${formTextColor}30` }}
      >
        <Calendar className="size-4 opacity-40" style={{ color: formTextColor }} />
        <span className={`text-sm opacity-40 ${fontFamilyClass}`} style={{ color: formTextColor }}>
          Select a date...
        </span>
      </div>
    );
  }

  // Legal
  if (type === 'legal') {
    return (
      <div className="flex items-center gap-2">
        <div
          className="size-4 rounded border flex items-center justify-center"
          style={{ borderColor: `${formTextColor}40` }}
        >
          <CheckCircle2 className="size-2.5" style={{ color: formButtonColor }} />
        </div>
        <span className={`text-xs ${fontFamilyClass}`} style={{ color: formTextColor }}>
          {question.settings?.requiredText || 'I accept'}
        </span>
      </div>
    );
  }

  // Statement
  if (type === 'statement') {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: formButtonColor, color: formButtonTextColor }}
      >
        Continue
        <ArrowRight className="size-3" />
      </div>
    );
  }

  // Ending
  if (type === 'ending') {
    return (
      <p className={`text-xs opacity-50 ${fontFamilyClass}`} style={{ color: formTextColor }}>
        {question.description || 'Your response has been recorded.'}
      </p>
    );
  }

  // Fallback
  return (
    <div
      className={`text-sm opacity-40 border-b pb-1 ${fontFamilyClass}`}
      style={{ color: formTextColor, borderBottomColor: `${formTextColor}30` }}
    >
      {question.placeholder || 'Your answer...'}
    </div>
  );
}

interface QuestionTypePreviewProps {
  question: FormQuestion;
  formTextColor: string;
  formButtonColor: string;
  formButtonTextColor: string;
  fontFamilyClass: string;
  editingOptionId: string | null;
  optionText: string;
  setEditingOptionId: (id: string | null) => void;
  setOptionText: (text: string) => void;
  handleOptionUpdate: (optionId: string, newLabel: string) => void;
  handleAddOption: () => void;
  handleRemoveOption: (optionId: string) => void;
  hoveredRating: number;
  setHoveredRating: (val: number) => void;
  selectedScale: number | null;
  setSelectedScale: (val: number | null) => void;
  updateQuestion: (questionId: string, updates: Partial<FormQuestion>) => void;
}

function QuestionTypePreview({
  question,
  formTextColor,
  formButtonColor,
  formButtonTextColor,
  fontFamilyClass,
  editingOptionId,
  optionText,
  setEditingOptionId,
  setOptionText,
  handleOptionUpdate,
  handleAddOption,
  handleRemoveOption,
  hoveredRating,
  setHoveredRating,
  selectedScale,
  setSelectedScale,
  updateQuestion,
}: QuestionTypePreviewProps) {
  const type = question.type;

  // Short Text
  if (type === 'short_text') {
    return (
      <Input
        placeholder={question.placeholder || 'Type your answer here...'}
        className={`text-lg h-12 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
        readOnly
      />
    );
  }

  // Long Text
  if (type === 'long_text') {
    return (
      <Textarea
        placeholder={question.placeholder || 'Type your answer here...'}
        className={`text-lg border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current resize-none min-h-[80px] ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
        readOnly
      />
    );
  }

  // Multiple Choice
  if (type === 'multiple_choice') {
    return (
      <div className="space-y-2">
        {question.options.map((option) => (
          <div
            key={option.id}
            className="flex items-center gap-3 group"
          >
            <div
              className="size-6 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{ borderColor: `${formTextColor}60` }}
            >
              <div className="size-2.5 rounded-full" style={{ backgroundColor: formButtonColor }} />
            </div>
            {editingOptionId === option.id ? (
              <input
                autoFocus
                value={optionText}
                onChange={(e) => setOptionText(e.target.value)}
                onBlur={() => {
                  if (optionText.trim()) {
                    handleOptionUpdate(option.id, optionText.trim());
                  } else {
                    setEditingOptionId(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && optionText.trim()) {
                    handleOptionUpdate(option.id, optionText.trim());
                  }
                  if (e.key === 'Escape') {
                    setEditingOptionId(null);
                  }
                }}
                className={`text-lg bg-transparent border-b-2 outline-none flex-1 ${fontFamilyClass}`}
                style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
              />
            ) : (
              <span
                onClick={() => {
                  setEditingOptionId(option.id);
                  setOptionText(option.label);
                }}
                className={`text-lg cursor-text hover:opacity-80 transition-opacity ${fontFamilyClass}`}
                style={{ color: formTextColor }}
              >
                {option.label}
              </span>
            )}
            <button
              onClick={() => handleRemoveOption(option.id)}
              className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity shrink-0"
            >
              <X className="size-4" style={{ color: formTextColor }} />
            </button>
          </div>
        ))}
        <button
          onClick={handleAddOption}
          className="flex items-center gap-3 mt-2 opacity-50 hover:opacity-80 transition-opacity"
        >
          <div
            className="size-6 rounded-full border-2 border-dashed flex items-center justify-center shrink-0"
            style={{ borderColor: `${formTextColor}40` }}
          >
            <Plus className="size-3" style={{ color: formTextColor }} />
          </div>
          <span className={`text-lg ${fontFamilyClass}`} style={{ color: formTextColor }}>
            Add option
          </span>
        </button>
      </div>
    );
  }

  // Picture Choice
  if (type === 'picture_choice') {
    return (
      <div className="flex flex-wrap gap-3">
        {question.options.map((option) => (
          <div
            key={option.id}
            className="group relative"
          >
            <div
              className="w-28 h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105"
              style={{ borderColor: `${formTextColor}30`, backgroundColor: `${formTextColor}08` }}
            >
              {option.image ? (
                <img src={option.image} alt={option.label} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <ImageIcon className="size-6 opacity-30" style={{ color: formTextColor }} />
              )}
              {editingOptionId === option.id ? (
                <input
                  autoFocus
                  value={optionText}
                  onChange={(e) => setOptionText(e.target.value)}
                  onBlur={() => {
                    if (optionText.trim()) handleOptionUpdate(option.id, optionText.trim());
                    else setEditingOptionId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && optionText.trim()) handleOptionUpdate(option.id, optionText.trim());
                    if (e.key === 'Escape') setEditingOptionId(null);
                  }}
                  className="text-xs bg-transparent border-b outline-none text-center w-20"
                  style={{ color: formTextColor }}
                />
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingOptionId(option.id);
                    setOptionText(option.label);
                  }}
                  className="text-xs font-medium text-center px-1 truncate w-20 cursor-text"
                  style={{ color: formTextColor }}
                >
                  {option.label}
                </span>
              )}
            </div>
            <button
              onClick={() => handleRemoveOption(option.id)}
              className="absolute -top-2 -right-2 size-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          onClick={handleAddOption}
          className="w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 opacity-40 hover:opacity-60 transition-opacity"
          style={{ borderColor: `${formTextColor}30` }}
        >
          <Plus className="size-6" style={{ color: formTextColor }} />
          <span className="text-xs" style={{ color: formTextColor }}>Add</span>
        </button>
      </div>
    );
  }

  // Dropdown
  if (type === 'dropdown') {
    return (
      <div className="space-y-2">
        <div
          className="flex items-center justify-between border-b-2 pb-2 cursor-pointer"
          style={{ borderBottomColor: `${formTextColor}40` }}
        >
          <span className={`text-lg opacity-50 ${fontFamilyClass}`} style={{ color: formTextColor }}>
            Select an option...
          </span>
          <ChevronDown className="size-5 opacity-50" style={{ color: formTextColor }} />
        </div>
        <div className="space-y-1 ml-4">
          {question.options.map((option) => (
            <div key={option.id} className="flex items-center gap-2 group">
              {editingOptionId === option.id ? (
                <input
                  autoFocus
                  value={optionText}
                  onChange={(e) => setOptionText(e.target.value)}
                  onBlur={() => {
                    if (optionText.trim()) handleOptionUpdate(option.id, optionText.trim());
                    else setEditingOptionId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && optionText.trim()) handleOptionUpdate(option.id, optionText.trim());
                    if (e.key === 'Escape') setEditingOptionId(null);
                  }}
                  className={`text-base bg-transparent border-b outline-none flex-1 ${fontFamilyClass}`}
                  style={{ color: formTextColor }}
                />
              ) : (
                <span
                  onClick={() => {
                    setEditingOptionId(option.id);
                    setOptionText(option.label);
                  }}
                  className={`text-base cursor-text hover:opacity-80 transition-opacity ${fontFamilyClass}`}
                  style={{ color: formTextColor }}
                >
                  {option.label}
                </span>
              )}
              <button
                onClick={() => handleRemoveOption(option.id)}
                className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity shrink-0"
              >
                <X className="size-3" style={{ color: formTextColor }} />
              </button>
            </div>
          ))}
          <button
            onClick={handleAddOption}
            className="flex items-center gap-1 opacity-50 hover:opacity-80 transition-opacity text-sm mt-1"
          >
            <Plus className="size-3" style={{ color: formTextColor }} />
            <span style={{ color: formTextColor }}>Add option</span>
          </button>
        </div>
      </div>
    );
  }

  // Yes/No
  if (type === 'yes_no') {
    return (
      <div className="flex gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-1 py-4 rounded-xl border-2 text-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            borderColor: `${formTextColor}30`,
            color: formTextColor,
          }}
        >
          <ThumbsUp className="size-5" />
          Yes
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-1 py-4 rounded-xl border-2 text-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            borderColor: `${formTextColor}30`,
            color: formTextColor,
          }}
        >
          <ThumbsUp className="size-5 rotate-180" />
          No
        </motion.button>
      </div>
    );
  }

  // Email
  if (type === 'email') {
    return (
      <Input
        placeholder={question.placeholder || 'name@example.com'}
        type="email"
        className={`text-lg h-12 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
        readOnly
      />
    );
  }

  // Phone
  if (type === 'phone') {
    return (
      <Input
        placeholder={question.placeholder || '+1 (555) 000-0000'}
        type="tel"
        className={`text-lg h-12 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
        readOnly
      />
    );
  }

  // Number
  if (type === 'number') {
    return (
      <Input
        placeholder={question.placeholder || 'Type a number...'}
        type="number"
        className={`text-lg h-12 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
        readOnly
      />
    );
  }

  // Website
  if (type === 'website') {
    return (
      <Input
        placeholder={question.placeholder || 'https://example.com'}
        type="url"
        className={`text-lg h-12 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current ${fontFamilyClass}`}
        style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
        readOnly
      />
    );
  }

  // Date
  if (type === 'date') {
    return (
      <div
        className="flex items-center gap-3 border-b-2 pb-2"
        style={{ borderBottomColor: `${formTextColor}40` }}
      >
        <Calendar className="size-5 opacity-50" style={{ color: formTextColor }} />
        <span className={`text-lg opacity-50 ${fontFamilyClass}`} style={{ color: formTextColor }}>
          Select a date...
        </span>
      </div>
    );
  }

  // Rating
  if (type === 'rating') {
    const steps = question.settings?.steps || 5;
    return (
      <div className="flex gap-2">
        {Array.from({ length: steps }, (_, i) => i + 1).map((step) => (
          <motion.button
            key={step}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={() => setHoveredRating(step)}
            onMouseLeave={() => setHoveredRating(0)}
            onClick={() => setSelectedScale(step)}
            className="p-1"
          >
            <Star
              className="size-10 transition-colors"
              style={{
                color:
                  hoveredRating >= step || (selectedScale !== null && selectedScale >= step)
                    ? formButtonColor
                    : `${formTextColor}30`,
                fill:
                  hoveredRating >= step || (selectedScale !== null && selectedScale >= step)
                    ? formButtonColor
                    : 'transparent',
              }}
            />
          </motion.button>
        ))}
      </div>
    );
  }

  // Opinion Scale
  if (type === 'opinion_scale') {
    const steps = question.settings?.steps || 10;
    const startAtOne = question.settings?.startAtOne ?? false;
    const start = startAtOne ? 1 : 0;
    const end = startAtOne ? steps : steps - 1;

    return (
      <div className="space-y-4">
        <div className="flex items-end gap-1">
          {Array.from({ length: end - start + 1 }, (_, i) => start + i).map((val) => (
            <motion.button
              key={val}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedScale(val)}
              className={`w-10 h-10 rounded-lg border-2 text-sm font-semibold flex items-center justify-center transition-all ${
                selectedScale === val ? 'scale-110' : ''
              }`}
              style={{
                borderColor: selectedScale === val ? formButtonColor : `${formTextColor}30`,
                backgroundColor: selectedScale === val ? formButtonColor : 'transparent',
                color: selectedScale === val ? formButtonTextColor : formTextColor,
              }}
            >
              {val}
            </motion.button>
          ))}
        </div>
        <div className="flex justify-between text-xs opacity-50" style={{ color: formTextColor }}>
          <span>{startAtOne ? '1 - Unlikely' : '0 - Unlikely'}</span>
          <span>{end} - Likely</span>
        </div>
      </div>
    );
  }

  // Legal
  if (type === 'legal') {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          className="size-6 rounded border-2 flex items-center justify-center"
          style={{ borderColor: `${formTextColor}60` }}
        >
          <CheckCircle2
            className="size-4"
            style={{ color: formButtonColor }}
          />
        </div>
        <span className={`text-lg ${fontFamilyClass}`} style={{ color: formTextColor }}>
          {question.settings?.requiredText || 'I accept'}
        </span>
      </label>
    );
  }

  // Statement
  if (type === 'statement') {
    return null; // Title + description is sufficient for statement
  }

  // Ending
  if (type === 'ending') {
    return (
      <div className="text-center space-y-2">
        <p className={`text-lg opacity-60 ${fontFamilyClass}`} style={{ color: formTextColor }}>
          {question.description || 'Your response has been recorded.'}
        </p>
      </div>
    );
  }

  // Fallback
  return (
    <Input
      placeholder={question.placeholder || 'Your answer...'}
      className={`text-lg h-12 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current ${fontFamilyClass}`}
      style={{ color: formTextColor, borderBottomColor: `${formTextColor}40` }}
      readOnly
    />
  );
}
