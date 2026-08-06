'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FormQuestion, QuestionOption, FormTheme } from '@/types/form';
import {
  Check,
  ChevronDown,
  Star,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  ImageIcon,
} from 'lucide-react';

interface QuestionInputProps {
  question: FormQuestion;
  value: string;
  onChange: (value: string) => void;
  onAdvance: () => void;
  theme: FormTheme;
  isActive: boolean;
}

const fontFamilyClass = (ff: string) =>
  ff === 'serif' ? 'font-serif' : ff === 'mono' ? 'font-mono' : 'font-sans';

export function QuestionInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  switch (question.type) {
    case 'short_text':
      return (
        <ShortTextInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'long_text':
      return (
        <LongTextInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'multiple_choice':
      return (
        <MultipleChoiceInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'picture_choice':
      return (
        <PictureChoiceInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'dropdown':
      return (
        <DropdownInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'yes_no':
      return (
        <YesNoInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'email':
      return (
        <EmailInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'phone':
      return (
        <PhoneInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'number':
      return (
        <NumberInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'website':
      return (
        <WebsiteInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'date':
      return (
        <DateInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'rating':
      return (
        <RatingInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'opinion_scale':
      return (
        <OpinionScaleInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'legal':
      return (
        <LegalInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'statement':
      return (
        <StatementInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
    case 'ending':
      return null;
    default:
      return (
        <ShortTextInput
          question={question}
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          theme={theme}
          isActive={isActive}
        />
      );
  }
}

/* ─── Short Text ─────────────────────────────────────────────────────── */

function ShortTextInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const ff = fontFamilyClass(theme.fontFamily);

  useEffect(() => {
    if (isActive && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdvance();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={question.placeholder || 'Type your answer here...'}
        className={`${ff} bg-transparent outline-none w-full text-2xl md:text-3xl pb-2 transition-colors duration-200 placeholder:opacity-100`}
        style={{
          color: theme.textColor,
          borderBottom: `2px solid ${focused ? theme.fieldHoverBorderColor : theme.fieldBorderColor}`,
          transition: 'border-color 0.2s ease',
        }}
      />
    </div>
  );
}

/* ─── Long Text ──────────────────────────────────────────────────────── */

function LongTextInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const ff = fontFamilyClass(theme.fontFamily);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onAdvance();
    }
  };

  return (
    <div className="w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={question.placeholder || 'Type your answer here...'}
        rows={4}
        className={`${ff} bg-transparent outline-none w-full text-xl md:text-2xl pb-2 resize-none transition-colors duration-200 placeholder:opacity-100`}
        style={{
          color: theme.textColor,
          borderBottom: `2px solid ${focused ? theme.fieldHoverBorderColor : theme.fieldBorderColor}`,
          transition: 'border-color 0.2s ease',
        }}
      />
      <p className="mt-2 text-sm" style={{ color: theme.textTertiaryColor }}>
        Ctrl + Enter ↵
      </p>
    </div>
  );
}

/* ─── Multiple Choice ────────────────────────────────────────────────── */

function MultipleChoiceInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const options = question.options || [];
  const settings = question.settings || {};
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const ff = fontFamilyClass(theme.fontFamily);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  // Auto-advance when value changes for single-select (not allowMultiple)
  useEffect(() => {
    if (!settings.allowMultiple && value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(onAdvance, 300);
    }
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [value, settings.allowMultiple, onAdvance]);

  const handleSelect = useCallback(
    (option: QuestionOption) => {
      if (settings.allowMultiple) {
        const currentIds = value ? value.split(',') : [];
        const newIds = currentIds.includes(option.id)
          ? currentIds.filter((v) => v !== option.id)
          : [...currentIds, option.id];
        onChange(newIds.join(','));
      } else {
        onChange(option.id);
      }
    },
    [value, onChange, settings.allowMultiple]
  );

  if (options.length === 0) return null;

  return (
    <div className="w-full space-y-2">
      {options.map((option, idx) => {
        const isSelected = settings.allowMultiple
          ? value.split(',').includes(option.id)
          : value === option.id;

        return (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.25 }}
            onClick={() => handleSelect(option)}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`w-full text-left px-5 py-3.5 rounded-lg border-2 transition-all duration-150 ${ff} text-lg flex items-center gap-3`}
            style={{
              borderColor: isSelected
                ? theme.buttonColor
                : hoveredIdx === idx
                ? theme.fieldHoverBorderColor
                : theme.fieldBorderColor,
              backgroundColor: isSelected
                ? theme.selectedSurfaceColor
                : hoveredIdx === idx
                ? theme.hoverSurfaceColor
                : 'transparent',
              color: theme.textColor,
            }}
          >
            <span
              className="size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150"
              style={{
                borderColor: isSelected ? theme.buttonColor : theme.fieldHoverBorderColor,
              }}
            >
              {isSelected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="size-3 rounded-full"
                  style={{ backgroundColor: theme.buttonColor }}
                />
              )}
            </span>
            <span className="flex-1">{option.label}</span>
            {isSelected && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <Check className="size-5" style={{ color: theme.buttonColor }} />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ─── Picture Choice ─────────────────────────────────────────────────── */

function PictureChoiceMedia({ imageUrl, alt, theme }: { imageUrl?: string; alt: string; theme: FormTheme }) {
  const [failed, setFailed] = useState(false);
  if (imageUrl && !failed) {
    return <img src={imageUrl} alt={alt} className="size-full object-cover" onError={() => setFailed(true)} />;
  }
  return (
    <div className="flex size-full items-center justify-center" style={{ backgroundColor: theme.controlSurfaceColor, color: theme.textTertiaryColor }}>
      <ImageIcon className="size-10" aria-hidden="true" />
    </div>
  );
}

function PictureChoiceInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const options = question.options || [];
  const images = question.imageUrls || [];
  const settings = question.settings || {};
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  // Auto-advance when value changes for single-select
  useEffect(() => {
    if (!settings.allowMultiple && value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(onAdvance, 300);
    }
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [value, settings.allowMultiple, onAdvance]);

  const handleSelect = useCallback(
    (option: QuestionOption) => {
      if (settings.allowMultiple) {
        const currentIds = value ? value.split(',') : [];
        const newIds = currentIds.includes(option.id)
          ? currentIds.filter((v) => v !== option.id)
          : [...currentIds, option.id];
        onChange(newIds.join(','));
      } else {
        onChange(option.id);
      }
    },
    [value, onChange, settings.allowMultiple]
  );

  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {options.map((option, idx) => {
        const isSelected = settings.allowMultiple
          ? value.split(',').includes(option.id)
          : value === option.id;
        const imageUrl = images[idx] || option.image;

        return (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05, duration: 0.25 }}
            onClick={() => handleSelect(option)}
            className="relative rounded-xl border-2 overflow-hidden transition-all duration-150 aspect-square"
            style={{
              borderColor: isSelected ? theme.buttonColor : theme.fieldBorderColor,
            }}
          >
            <PictureChoiceMedia imageUrl={imageUrl} alt={option.label} theme={theme} />
            <div
              className="absolute bottom-0 inset-x-0 px-3 py-2 text-sm font-medium text-center truncate"
              style={{
                backgroundColor: theme.backgroundColor,
                color: theme.textColor,
              }}
            >
              {option.label}
            </div>
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 size-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
              >
                <Check className="size-4" />
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ─── Dropdown ───────────────────────────────────────────────────────── */

function DropdownInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const options = question.options || [];
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ff = fontFamilyClass(theme.fontFamily);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-advance when value changes
  useEffect(() => {
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(onAdvance, 300);
    }
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [value, onAdvance]);

  const handleSelect = (option: QuestionOption) => {
    onChange(option.id);
    setIsOpen(false);
  };

  // Find the label of the currently selected option for display
  const selectedOption = options.find((opt) => opt.id === value);
  const displayValue = selectedOption?.label || '';

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left px-4 py-3.5 rounded-lg border-2 transition-all duration-150 ${ff} text-lg flex items-center justify-between`}
        style={{
          borderColor: isOpen ? theme.buttonColor : theme.fieldBorderColor,
          color: displayValue ? theme.textColor : theme.placeholderColor,
          backgroundColor: isOpen ? theme.selectedSurfaceColor : 'transparent',
        }}
      >
        <span>{displayValue || question.placeholder || 'Select an option...'}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-5" style={{ color: theme.textSecondaryColor }} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 rounded-lg border-2 overflow-hidden z-50 max-h-80 overflow-y-auto"
            style={{
              borderColor: theme.fieldBorderColor,
              backgroundColor: theme.backgroundColor,
            }}
          >
            {options.map((option, idx) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`w-full text-left px-4 py-3 text-lg transition-colors duration-100 ${ff}`}
                style={{
                  backgroundColor: hoveredIdx === idx ? theme.selectedSurfaceColor : 'transparent',
                  color: theme.textColor,
                }}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Yes/No ─────────────────────────────────────────────────────────── */

function YesNoInput({
  value,
  onChange,
  onAdvance,
  theme,
}: QuestionInputProps) {
  const ff = fontFamilyClass(theme.fontFamily);
  const [hovered, setHovered] = useState<'yes' | 'no' | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  // Auto-advance when value changes
  useEffect(() => {
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(onAdvance, 300);
    }
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [value, onAdvance]);

  const handleSelect = (val: string) => {
    onChange(val);
  };

  return (
    <div className="w-full flex gap-4">
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => handleSelect('Yes')}
        onMouseEnter={() => setHovered('yes')}
        onMouseLeave={() => setHovered(null)}
        className={`flex-1 py-5 rounded-xl border-2 transition-all duration-150 flex flex-col items-center gap-2 ${ff} text-xl font-semibold`}
        style={{
          borderColor: value === 'Yes' ? theme.buttonColor : hovered === 'yes' ? theme.fieldHoverBorderColor : theme.fieldBorderColor,
          backgroundColor: value === 'Yes' ? theme.selectedSurfaceColor : hovered === 'yes' ? theme.hoverSurfaceColor : 'transparent',
          color: value === 'Yes' ? theme.accentTextColor : theme.textColor,
        }}
      >
        <ThumbsUp className="size-8" />
        Yes
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => handleSelect('No')}
        onMouseEnter={() => setHovered('no')}
        onMouseLeave={() => setHovered(null)}
        className={`flex-1 py-5 rounded-xl border-2 transition-all duration-150 flex flex-col items-center gap-2 ${ff} text-xl font-semibold`}
        style={{
          borderColor: value === 'No' ? theme.buttonColor : hovered === 'no' ? theme.fieldHoverBorderColor : theme.fieldBorderColor,
          backgroundColor: value === 'No' ? theme.selectedSurfaceColor : hovered === 'no' ? theme.hoverSurfaceColor : 'transparent',
          color: value === 'No' ? theme.accentTextColor : theme.textColor,
        }}
      >
        <ThumbsDown className="size-8" />
        No
      </motion.button>
    </div>
  );
}

/* ─── Email ──────────────────────────────────────────────────────────── */

function EmailInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const ff = fontFamilyClass(theme.fontFamily);

  useEffect(() => {
    if (isActive && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const validate = (val: string) => {
    if (!val) { setError(''); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setError('Please enter a valid email address');
      return false;
    }
    setError('');
    return true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (validate(value)) onAdvance();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => { onChange(e.target.value); validate(e.target.value); }}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={question.placeholder || 'name@example.com'}
        className={`${ff} bg-transparent outline-none w-full text-2xl md:text-3xl pb-2 transition-colors duration-200 placeholder:opacity-100`}
        style={{
          color: theme.textColor,
          borderBottom: `2px solid ${error ? theme.errorColor : focused ? theme.fieldHoverBorderColor : theme.fieldBorderColor}`,
          transition: 'border-color 0.2s ease',
        }}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-sm mt-2" style={{ color: theme.errorColor }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Phone ──────────────────────────────────────────────────────────── */

function PhoneInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const ff = fontFamilyClass(theme.fontFamily);

  useEffect(() => {
    if (isActive && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdvance();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={question.placeholder || '+1 (555) 000-0000'}
        className={`${ff} bg-transparent outline-none w-full text-2xl md:text-3xl pb-2 transition-colors duration-200 placeholder:opacity-100`}
        style={{
          color: theme.textColor,
          borderBottom: `2px solid ${focused ? theme.fieldHoverBorderColor : theme.fieldBorderColor}`,
          transition: 'border-color 0.2s ease',
        }}
      />
    </div>
  );
}

/* ─── Number ─────────────────────────────────────────────────────────── */

function NumberInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const ff = fontFamilyClass(theme.fontFamily);
  const settings = question.settings || {};
  const min = settings.min ?? 0;
  const max = settings.max ?? 100;

  useEffect(() => {
    if (isActive && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdvance();
    }
  };

  const handleStep = (delta: number) => {
    const current = parseFloat(value) || 0;
    const next = Math.min(max, Math.max(min, current + delta));
    onChange(String(next));
  };

  return (
    <div className="w-full flex items-end gap-3">
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={question.placeholder || 'Type a number...'}
        min={min}
        max={max}
        className={`${ff} bg-transparent outline-none flex-1 text-2xl md:text-3xl pb-2 transition-colors duration-200 placeholder:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        style={{
          color: theme.textColor,
          borderBottom: `2px solid ${focused ? theme.fieldHoverBorderColor : theme.fieldBorderColor}`,
          transition: 'border-color 0.2s ease',
        }}
      />
      <div className="flex flex-col gap-1 pb-2">
        <button
          onClick={() => handleStep(1)}
          className="size-11 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
          style={{ backgroundColor: theme.controlSurfaceColor, color: theme.accentTextColor }}
        >
          <span className="text-lg font-bold">+</span>
        </button>
        <button
          onClick={() => handleStep(-1)}
          className="size-11 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
          style={{ backgroundColor: theme.controlSurfaceColor, color: theme.accentTextColor }}
        >
          <span className="text-lg font-bold">−</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Website ────────────────────────────────────────────────────────── */

function WebsiteInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const ff = fontFamilyClass(theme.fontFamily);

  useEffect(() => {
    if (isActive && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdvance();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={question.placeholder || 'https://example.com'}
        className={`${ff} bg-transparent outline-none w-full text-2xl md:text-3xl pb-2 transition-colors duration-200 placeholder:opacity-100`}
        style={{
          color: theme.textColor,
          borderBottom: `2px solid ${focused ? theme.fieldHoverBorderColor : theme.fieldBorderColor}`,
          transition: 'border-color 0.2s ease',
        }}
      />
    </div>
  );
}

/* ─── Date ───────────────────────────────────────────────────────────── */

function DateInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
  isActive,
}: QuestionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const ff = fontFamilyClass(theme.fontFamily);

  useEffect(() => {
    if (isActive && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdvance();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={question.placeholder || 'Select a date...'}
        className={`${ff} bg-transparent outline-none w-full text-2xl md:text-3xl pb-2 transition-colors duration-200 placeholder:opacity-100`}
        style={{
          color: theme.textColor,
          borderBottom: `2px solid ${focused ? theme.fieldHoverBorderColor : theme.fieldBorderColor}`,
          transition: 'border-color 0.2s ease',
        }}
      />
    </div>
  );
}

/* ─── Rating ─────────────────────────────────────────────────────────── */

function RatingInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
}: QuestionInputProps) {
  const settings = question.settings || {};
  const steps = settings.steps || 5;
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const currentRating = parseInt(value) || 0;
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  // Auto-advance when value changes
  useEffect(() => {
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(onAdvance, 400);
    }
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [value, onAdvance]);

  const handleSelect = (rating: number) => {
    onChange(String(rating));
  };

  return (
    <div className="w-full flex gap-2">
      {Array.from({ length: steps }, (_, i) => i + 1).map((star) => {
        const filled = star <= (hoveredStar ?? currentRating);
        return (
          <motion.button
            key={star}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(null)}
            onClick={() => handleSelect(star)}
            className="transition-transform duration-100"
          >
            <Star
              className="size-12 md:size-14 transition-colors duration-150"
              style={{
                color: filled ? theme.buttonColor : theme.fieldBorderColor,
                fill: filled ? theme.buttonColor : 'transparent',
              }}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

/* ─── Opinion Scale ──────────────────────────────────────────────────── */

function OpinionScaleInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
}: QuestionInputProps) {
  const settings = question.settings || {};
  const steps = settings.steps || 10;
  const startAtOne = settings.startAtOne ?? false;
  const startNum = startAtOne ? 1 : 0;
  const numbers = Array.from({ length: steps + 1 }, (_, i) => startNum + i);
  const [hoveredNum, setHoveredNum] = useState<number | null>(null);
  const currentValue = parseInt(value);
  const ff = fontFamilyClass(theme.fontFamily);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  // Auto-advance when value changes
  useEffect(() => {
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(onAdvance, 350);
    }
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [value, onAdvance]);

  const handleSelect = (num: number) => {
    onChange(String(num));
  };

  return (
    <div className="w-full">
      <div className="flex gap-2 flex-wrap">
        {numbers.map((num) => {
          const isSelected = num === currentValue;
          const isHovered = num === hoveredNum;
          return (
            <motion.button
              key={num}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={() => setHoveredNum(num)}
              onMouseLeave={() => setHoveredNum(null)}
              onClick={() => handleSelect(num)}
              className={`size-12 md:size-14 rounded-lg border-2 flex items-center justify-center text-lg font-semibold transition-all duration-150 ${ff}`}
              style={{
                borderColor: isSelected
                  ? theme.buttonColor
                  : isHovered
                  ? theme.fieldHoverBorderColor
                  : theme.fieldBorderColor,
                backgroundColor: isSelected
                  ? theme.buttonColor
                  : isHovered
                  ? theme.selectedSurfaceColor
                  : 'transparent',
                color: isSelected ? theme.buttonTextColor : theme.textColor,
              }}
            >
              {num}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-sm" style={{ color: theme.textSecondaryColor }}>
        <span>{startNum === 0 ? 'Not at all likely' : '1'}</span>
        <span>{startNum + steps === 10 ? 'Extremely likely' : String(startNum + steps)}</span>
      </div>
    </div>
  );
}

/* ─── Legal ──────────────────────────────────────────────────────────── */

function LegalInput({
  question,
  value,
  onChange,
  onAdvance,
  theme,
}: QuestionInputProps) {
  const accepted = value === 'true';
  const ff = fontFamilyClass(theme.fontFamily);
  const settings = question.settings || {};
  const labelText = settings.requiredText || question.title;

  const handleToggle = () => {
    const newVal = !accepted;
    onChange(String(newVal));
  };

  return (
    <div className="w-full space-y-6">
      <button
        onClick={handleToggle}
        className={`flex min-h-11 items-center gap-3 rounded-lg px-2 text-left transition-colors hover:opacity-80 ${ff}`}
      >
        <span
          className="size-7 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-150"
          style={{
            borderColor: accepted ? theme.buttonColor : theme.fieldHoverBorderColor,
            backgroundColor: accepted ? theme.buttonColor : 'transparent',
          }}
        >
          {accepted && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <Check className="size-4" style={{ color: theme.buttonTextColor }} />
            </motion.span>
          )}
        </span>
        <span className="text-lg" style={{ color: theme.textColor }}>
          {labelText}
        </span>
      </button>
    </div>
  );
}

/* ─── Statement ──────────────────────────────────────────────────────── */

function StatementInput({
  question,
  onAdvance,
  theme,
}: QuestionInputProps) {
  const ff = fontFamilyClass(theme.fontFamily);

  return (
    <div className="w-full max-w-2xl">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onAdvance}
        className={`inline-flex items-center gap-2 px-8 py-3 rounded-full text-lg font-medium transition-colors ${ff}`}
        style={{
          backgroundColor: theme.buttonColor,
          color: theme.buttonTextColor,
        }}
      >
        Continue
        <ArrowRight className="size-5" />
      </motion.button>
    </div>
  );
}
