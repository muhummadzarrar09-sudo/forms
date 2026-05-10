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
            <div className="bg-popover border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              {/* Header with search */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Add question</h3>
                  <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
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

              {/* Type grid */}
              <ScrollArea className="max-h-[60vh]">
                <div className="p-4 space-y-6">
                  {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((category) => (
                    <div key={category}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        {category}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {grouped[category]?.map((item) => {
                          const IconComponent = ICON_MAP[item.icon] || Type;
                          const isActive = currentType === item.type;
                          return (
                            <motion.button
                              key={item.type}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleSelect(item.type)}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150
                                ${
                                  isActive
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-border/60 hover:border-primary/40 hover:bg-accent/50'
                                }`}
                            >
                              <div
                                className={`size-9 rounded-lg flex items-center justify-center shrink-0
                                  ${isActive ? 'bg-primary/10' : 'bg-muted'}`}
                              >
                                <IconComponent className={`size-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <span className="text-sm font-medium truncate">{item.label}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {Object.keys(grouped).length === 0 && (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <Search className="size-8 mb-2 opacity-40" />
                      <p className="text-sm">No question types found</p>
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
