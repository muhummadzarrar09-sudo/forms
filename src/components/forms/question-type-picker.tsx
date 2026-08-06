'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuestionType } from '@/types/form';
import { QUESTION_TYPES } from '@/lib/form-helpers';
import {
  Type,
  AlignLeft,
  List,
  Image,
  ChevronDown,
  ThumbsUp,
  Mail,
  Phone,
  Hash,
  Globe,
  Calendar,
  Star,
  BarChart3,
  FileText,
  MessageSquare,
  Square,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const ICON_MAP: Record<string, React.ElementType> = {
  Type,
  AlignLeft,
  List,
  Image,
  ChevronDown,
  ThumbsUp,
  Mail,
  Phone,
  Hash,
  Globe,
  Calendar,
  Star,
  BarChart3,
  FileText,
  MessageSquare,
  Square,
};

const CATEGORY_ORDER = ['Text', 'Choices', 'Fields', 'Rating', 'Other'];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Text: 'Free-form text inputs',
  Choices: 'Select from options',
  Fields: 'Specialized input fields',
  Rating: 'Scales and ratings',
  Other: 'Special question types',
};

// Mini preview icons for each type - small visual indicator
const TYPE_PREVIEW: Record<string, string> = {
  short_text: 'Single line',
  long_text: 'Paragraph',
  multiple_choice: 'Choose one',
  picture_choice: 'Image choices',
  dropdown: 'Select menu',
  yes_no: 'Two choices',
  email: 'Email address',
  phone: 'Phone number',
  number: 'Numeric value',
  website: 'Web address',
  date: 'Date picker',
  rating: 'Star scale',
  opinion_scale: 'Number scale',
  legal: 'Consent',
  statement: 'Information',
  ending: 'End screen',
};

interface QuestionTypePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: QuestionType) => void;
  currentType?: QuestionType;
}

export function QuestionTypePicker({ open, onClose, onSelect, currentType }: QuestionTypePickerProps) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const filtered = search.trim()
      ? QUESTION_TYPES.filter(
          (t) =>
            t.label.toLowerCase().includes(search.toLowerCase()) ||
            t.category.toLowerCase().includes(search.toLowerCase())
        )
      : QUESTION_TYPES;

    const groups: Record<string, typeof QUESTION_TYPES> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [search]);

  const handleSelect = (type: QuestionType) => {
    onSelect(type);
    setSearch('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Picker panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-popover border rounded-xl shadow-[var(--shadow-3)] w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
              {/* Header with search */}
              <div className="p-4 border-b shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">Add question</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Choose a question type for your form</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-11" onClick={onClose} aria-label="Close question type picker">
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search question types..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                    autoFocus
                  />
                </div>
              </div>

              {/* Type grid with categories */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-6">
                  {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((category) => (
                    <div key={category}>
                      <div className="mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {category}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {CATEGORY_DESCRIPTIONS[category]}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {grouped[category]?.map((item) => {
                          const IconComponent = ICON_MAP[item.icon] || Type;
                          const isActive = currentType === item.type;
                          const preview = TYPE_PREVIEW[item.type];
                          return (
                            <motion.button
                              key={item.type}
                              whileHover={{ scale: 1.02, y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleSelect(item.type)}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 group
                                ${
                                  isActive
                                    ? 'border-primary bg-primary/5 text-primary shadow-[var(--shadow-1)]'
                                    : 'border-border/60 hover:border-primary/40 hover:bg-accent/50 hover:shadow-[var(--shadow-1)]'
                                }`}
                            >
                              <div
                                className={`size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                  ${isActive ? 'bg-primary/10' : 'bg-muted group-hover:bg-primary/5'}`}
                              >
                                <IconComponent className={`size-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary/70'}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium truncate block">{item.label}</span>
                                <span className="text-xs text-muted-foreground">{preview}</span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {Object.keys(grouped).length === 0 && (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <Search className="size-8 mb-2 text-muted-foreground" />
                      <p className="text-sm">No question types found</p>
                      <p className="mt-1 text-xs">Try a different search term</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
