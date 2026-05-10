'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormStore } from '@/store/form-store';
import type { Form, FormQuestion, QuestionType } from '@/types/form';
import {
  createDefaultQuestion,
  getQuestionTypeIcon,
} from '@/lib/form-helpers';
import { QuestionEditor } from '@/components/forms/question-editor';
import { QuestionTypePicker } from '@/components/forms/question-type-picker';
import { DesignPanel } from '@/components/forms/design-panel';
import { ShareDialog } from '@/components/forms/share-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Plus,
  Eye,
  MoreHorizontal,
  Copy,
  Trash2,
  GripVertical,
  HandMetal,
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
  Sparkles,
  Check,
  FileCheck,
  Settings2,
  PanelRightOpen,
  PanelRightClose,
  Share2,
  Menu,
  PanelLeftOpen,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

// Debounce helper
function useDebounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  return useCallback(
    (...args: unknown[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fn(...args), ms);
    },
    [fn, ms]
  ) as T;
}

export function FormBuilder() {
  const {
    currentForm,
    selectedFormId,
    selectedQuestionId,
    isLoading,
    isSaving,
    setCurrentForm,
    setSelectedQuestionId,
    setIsLoading,
    setIsSaving,
    updateForm,
    updateQuestion,
    addQuestion,
    removeQuestion,
    reorderQuestions,
    openDashboard,
    openFiller,
  } = useFormStore();

  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [isEditingFormTitle, setIsEditingFormTitle] = useState(false);

  // Fetch form on mount
  useEffect(() => {
    if (!selectedFormId) return;

    const fetchForm = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/forms/${selectedFormId}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentForm(data);
          setFormTitle(data.title);
          // Select first question if none selected
          if (data.questions?.length > 0 && !selectedQuestionId) {
            setSelectedQuestionId(data.questions[0].id);
          }
        } else {
          toast({ title: 'Error', description: 'Could not load form', variant: 'destructive' });
          openDashboard();
        }
      } catch {
        toast({ title: 'Network error', variant: 'destructive' });
        openDashboard();
      } finally {
        setIsLoading(false);
      }
    };
    fetchForm();
  }, [selectedFormId, setCurrentForm, setIsLoading, setSelectedQuestionId, openDashboard]);

  // Sync form title when it changes externally (via key-based remount approach)

  // ── Auto-save form settings (debounced) ──
  const saveFormSettings = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!currentForm) return;
      try {
        const res = await fetch(`/api/forms/${currentForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const saved = await res.json();
          setCurrentForm(saved);
        }
      } catch {
        // Silent fail for auto-save
      }
    },
    [currentForm, setCurrentForm]
  );

  const debouncedSaveForm = useDebounce(saveFormSettings, 800);

  // ── Auto-save questions (debounced) ──
  const isSavingRef = useRef(false);
  const lastSavedHashRef = useRef<string>('');

  const saveQuestions = useCallback(async (questionsToSave?: FormQuestion[]) => {
    if (!currentForm) return;
    const questions = questionsToSave || currentForm.questions;

    // Create a hash to detect actual changes
    const hash = JSON.stringify(questions.map(q => ({
      id: q.id, type: q.type, title: q.title, description: q.description,
      required: q.required, order: q.order, options: q.options,
      settings: q.settings, placeholder: q.placeholder
    })));

    if (hash === lastSavedHashRef.current) return; // No changes since last save
    lastSavedHashRef.current = hash;

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/forms/${currentForm.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      if (res.ok) {
        const saved = await res.json();
        // Only update if IDs changed (temp -> real)
        const hasTempIds = questions.some(q => q.id.startsWith('temp_'));
        if (hasTempIds) {
          setCurrentForm({
            ...currentForm,
            questions: saved,
          });
        }
      } else {
        lastSavedHashRef.current = ''; // Reset on failure to allow retry
      }
    } catch {
      lastSavedHashRef.current = ''; // Reset on failure to allow retry
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [currentForm, setCurrentForm, setIsSaving]);

  const debouncedSaveQuestions = useDebounce(saveQuestions, 1500);

  // Trigger question save when questions change
  const questionsChangeCount = useRef(0);
  useEffect(() => {
    if (!currentForm || isLoading || isSavingRef.current) return;
    questionsChangeCount.current++;
    // Skip the first trigger (initial load)
    if (questionsChangeCount.current <= 1) return;
    debouncedSaveQuestions();
  }, [currentForm?.questions, debouncedSaveQuestions, isLoading]);

  // Update selectedQuestionId when temp IDs are replaced with real IDs after save
  const prevSelectedTitleRef = useRef<string>('');
  useEffect(() => {
    if (!currentForm || !selectedQuestionId) return;
    const currentIds = new Set(currentForm.questions.map(q => q.id));
    if (currentIds.has(selectedQuestionId)) {
      // Update the ref with current title
      const sq = currentForm.questions.find(q => q.id === selectedQuestionId);
      if (sq) prevSelectedTitleRef.current = sq.title;
      return;
    }

    // selectedQuestionId no longer exists - find the question that replaced it by title
    const replacement = currentForm.questions.find(q => q.title === prevSelectedTitleRef.current);
    if (replacement) {
      setSelectedQuestionId(replacement.id);
    } else if (currentForm.questions.length > 0) {
      setSelectedQuestionId(currentForm.questions[0].id);
    } else {
      setSelectedQuestionId(null);
    }
  }, [currentForm?.questions, selectedQuestionId, setSelectedQuestionId]);

  // ── Questions ──
  const sortedQuestions = useMemo(
    () => [...(currentForm?.questions || [])].sort((a, b) => a.order - b.order),
    [currentForm?.questions]
  );

  const selectedQuestion = useMemo(
    () => sortedQuestions.find((q) => q.id === selectedQuestionId) || null,
    [sortedQuestions, selectedQuestionId]
  );

  // ── Drag & Drop ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedQuestions.findIndex((q) => q.id === active.id);
      const newIndex = sortedQuestions.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortedQuestions, oldIndex, newIndex);
      reorderQuestions(reordered.map((q) => q.id));
    },
    [sortedQuestions, reorderQuestions]
  );

  // ── Add Question ──
  const handleAddQuestion = useCallback(
    (type: QuestionType) => {
      if (!currentForm) return;
      const newQ = createDefaultQuestion(type, currentForm.id, sortedQuestions.length);
      addQuestion(newQ);
      setSelectedQuestionId(newQ.id);
    },
    [currentForm, sortedQuestions.length, addQuestion, setSelectedQuestionId]
  );

  // ── Change Question Type ──
  const handleQuestionTypeChange = useCallback(
    (newType: QuestionType) => {
      if (!selectedQuestion || !currentForm) return;
      // Create defaults for the new type, but keep the title
      const defaults = createDefaultQuestion(newType, currentForm.id, selectedQuestion.order);
      updateQuestion(selectedQuestion.id, {
        type: newType,
        options: defaults.options,
        settings: defaults.settings,
        placeholder: defaults.placeholder,
      });
    },
    [selectedQuestion, currentForm, updateQuestion]
  );

  // ── Delete Question ──
  const handleDeleteQuestion = useCallback(
    (questionId: string) => {
      removeQuestion(questionId);
      if (selectedQuestionId === questionId) {
        const remaining = sortedQuestions.filter((q) => q.id !== questionId);
        setSelectedQuestionId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [removeQuestion, selectedQuestionId, sortedQuestions, setSelectedQuestionId]
  );

  // ── Duplicate Question ──
  const handleDuplicateQuestion = useCallback(
    (question: FormQuestion) => {
      if (!currentForm) return;
      const dup: FormQuestion = {
        ...question,
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order: question.order + 1,
        title: `${question.title} (copy)`,
        options: question.options.map((opt) => ({
          ...opt,
          id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        })),
      };
      addQuestion(dup);
      setSelectedQuestionId(dup.id);
    },
    [currentForm, addQuestion, setSelectedQuestionId]
  );

  // ── Publish ──
  const handlePublish = useCallback(async () => {
    if (!currentForm) return;
    const newPublished = !currentForm.published;
    updateForm(currentForm.id, { published: newPublished });
    await saveFormSettings({ published: newPublished });
    toast({
      title: newPublished ? 'Form published' : 'Form unpublished',
      description: newPublished
        ? 'Your form is now live and accepting responses.'
        : 'Your form is now in draft mode.',
    });
  }, [currentForm, updateForm, saveFormSettings]);

  // ── Form title save ──
  const handleFormTitleSave = useCallback(async () => {
    setIsEditingFormTitle(false);
    if (!currentForm || !formTitle.trim()) {
      setFormTitle(currentForm?.title || '');
      return;
    }
    if (formTitle.trim() !== currentForm.title) {
      updateForm(currentForm.id, { title: formTitle.trim() });
      await saveFormSettings({ title: formTitle.trim() });
    }
  }, [currentForm, formTitle, updateForm, saveFormSettings]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading form builder...</p>
        </div>
      </div>
    );
  }

  if (!currentForm) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="h-12 border-b bg-background/95 backdrop-blur-sm flex items-center px-3 gap-2 shrink-0 z-20">
        {/* Back */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={openDashboard}>
                <ArrowLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to dashboard</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Mobile: toggle left panel */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 md:hidden"
          onClick={() => setShowLeftPanel(!showLeftPanel)}
        >
          <Menu className="size-4" />
        </Button>

        <Separator orientation="vertical" className="h-5 hidden md:block" />

        {/* Form title */}
        <div className="flex-1 min-w-0">
          {isEditingFormTitle ? (
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              onBlur={handleFormTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFormTitleSave();
                if (e.key === 'Escape') {
                  setFormTitle(currentForm.title);
                  setIsEditingFormTitle(false);
                }
              }}
              autoFocus
              className="h-7 text-sm font-medium"
            />
          ) : (
            <button
              onClick={() => setIsEditingFormTitle(true)}
              className="text-sm font-medium hover:text-primary transition-colors truncate max-w-[300px]"
            >
              {currentForm.title}
            </button>
          )}
        </div>

        {/* Saving indicator */}
        {isSaving && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <div className="size-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            Saving
          </span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {/* Toggle right panel on mobile */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 lg:hidden"
                  onClick={() => setShowRightPanel(!showRightPanel)}
                >
                  <Settings2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle settings</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs hidden sm:flex"
                  onClick={() => setShowShareDialog(true)}
                >
                  <Share2 className="size-3.5" />
                  Share
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share form</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs hidden sm:flex"
                  onClick={() => openFiller(currentForm.id)}
                >
                  <Eye className="size-3.5" />
                  Preview
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview form</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            size="sm"
            className={`h-8 gap-1.5 text-xs ${currentForm.published ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={handlePublish}
          >
            {currentForm.published ? (
              <>
                <Check className="size-3.5" />
                <span className="hidden sm:inline">Published</span>
              </>
            ) : (
              <>
                <FileCheck className="size-3.5" />
                <span className="hidden sm:inline">Publish</span>
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Mobile-only actions */}
              <DropdownMenuItem className="sm:hidden" onClick={() => setShowShareDialog(true)}>
                <Share2 className="size-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem className="sm:hidden" onClick={() => openFiller(currentForm.id)}>
                <Eye className="size-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem onClick={() => selectedQuestion && handleDuplicateQuestion(selectedQuestion)}>
                <Copy className="size-4 mr-2" />
                Duplicate question
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => selectedQuestion && handleDeleteQuestion(selectedQuestion.id)}>
                <Trash2 className="size-4 mr-2" />
                Delete question
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowRightPanel(!showRightPanel)}>
                {showRightPanel ? (
                  <PanelRightClose className="size-4 mr-2" />
                ) : (
                  <PanelRightOpen className="size-4 mr-2" />
                )}
                {showRightPanel ? 'Hide panel' : 'Show panel'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Main Content: 3 columns ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile left panel overlay */}
        {showLeftPanel && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setShowLeftPanel(false)}
          />
        )}

        {/* ── Left Panel: Question List ── */}
        <div className={`w-64 border-r bg-muted/30 flex flex-col shrink-0 z-40 transition-transform duration-200 ${
          showLeftPanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } fixed md:relative h-[calc(100vh-3rem)] md:h-auto`}>
          {/* Welcome Screen item */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => {
                setSelectedQuestionId(null);
                setShowLeftPanel(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                !selectedQuestionId
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <div className={`size-7 rounded flex items-center justify-center shrink-0 ${
                !selectedQuestionId ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <Sparkles className="size-3.5" />
              </div>
              <span className="truncate">Welcome Screen</span>
            </button>
          </div>

          {/* Questions list */}
          <ScrollArea className="flex-1 px-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedQuestions.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5 py-1">
                  {sortedQuestions.map((question, index) => (
                    <SortableQuestionItem
                      key={question.id}
                      question={question}
                      index={index}
                      isSelected={selectedQuestionId === question.id}
                      onSelect={() => {
                        setSelectedQuestionId(question.id);
                        setShowLeftPanel(false);
                      }}
                      onDelete={() => handleDeleteQuestion(question.id)}
                      onDuplicate={() => handleDuplicateQuestion(question)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>

          {/* Add question button */}
          <div className="p-3 border-t">
            <Button
              variant="outline"
              className="w-full gap-2 text-sm"
              onClick={() => setShowTypePicker(true)}
            >
              <Plus className="size-4" />
              Add question
            </Button>
          </div>

          {/* Ending Screen item */}
          <div className="px-3 pb-3">
            <button
              onClick={() => {
                // Find ending question or do nothing
                const endingQ = sortedQuestions.find((q) => q.type === 'ending');
                if (endingQ) setSelectedQuestionId(endingQ.id);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                sortedQuestions.find((q) => q.type === 'ending')?.id === selectedQuestionId
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <div className={`size-7 rounded flex items-center justify-center shrink-0 ${
                sortedQuestions.find((q) => q.type === 'ending')?.id === selectedQuestionId ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <HandMetal className="size-3.5" />
              </div>
              <span className="truncate">Ending Screen</span>
            </button>
          </div>
        </div>

        {/* ── Center Panel: Question Editor / Preview ── */}
        <div className="flex-1 overflow-hidden min-w-0">
          {selectedQuestion ? (
            <QuestionEditor
              key={selectedQuestion.id}
              question={selectedQuestion}
              questionIndex={sortedQuestions.findIndex((q) => q.id === selectedQuestion.id)}
              totalQuestions={sortedQuestions.length}
              formBackgroundColor={currentForm.backgroundColor}
              formTextColor={currentForm.textColor}
              formButtonColor={currentForm.buttonColor}
              formButtonTextColor={currentForm.buttonTextColor}
              formFontFamily={currentForm.fontFamily}
            />
          ) : (
            /* Welcome Screen preview */
            <WelcomeScreenPreview form={currentForm} />
          )}
        </div>

        {/* ── Right Panel: Settings / Design ── */}
        <AnimatePresence>
          {showRightPanel && (
            <>
              {/* Mobile overlay for right panel */}
              <div
                className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                onClick={() => setShowRightPanel(false)}
              />
              <motion.div
                initial={{ x: 280, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 280, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="fixed right-0 top-12 bottom-0 w-[280px] z-40 lg:relative lg:top-auto lg:bottom-auto lg:shrink-0 border-l bg-background"
              >
                <DesignPanel
                  selectedQuestion={selectedQuestion}
                  onQuestionTypeChange={handleQuestionTypeChange}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Question Type Picker Modal */}
      <QuestionTypePicker
        open={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        onSelect={handleAddQuestion}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        form={currentForm}
        onPublish={handlePublish}
      />
    </div>
  );
}

// ── Sortable Question Item ──────────────────────────────────────────────────

function SortableQuestionItem({
  question,
  index,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  question: FormQuestion;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const IconComponent = ICON_MAP[getQuestionTypeIcon(question.type)] || Type;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all relative ${
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-accent/50 text-foreground'
        }`}
        onClick={onSelect}
      >
        {/* Left border indicator for selected state */}
        {isSelected && (
          <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
        )}
        {/* Drag handle */}
        <button
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>

        {/* Question number */}
        <span
          className={`size-6 rounded text-xs font-bold flex items-center justify-center shrink-0 ${
            isSelected ? 'bg-primary/20' : 'bg-muted'
          }`}
        >
          {index + 1}
        </span>

        {/* Icon */}
        <IconComponent className="size-3.5 shrink-0 opacity-60" />

        {/* Title */}
        <span className="flex-1 text-sm truncate">{question.title}</span>

        {/* Actions on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="size-5 rounded flex items-center justify-center hover:bg-accent"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="size-3.5 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ── Welcome Screen Preview ──────────────────────────────────────────────────

function WelcomeScreenPreview({ form }: { form: Form }) {
  const fontFamilyClass =
    form.fontFamily === 'serif'
      ? 'font-serif'
      : form.fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 py-12 h-full"
      style={{ backgroundColor: form.backgroundColor, color: form.textColor }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="text-center max-w-lg space-y-6"
      >
        <h1
          className={`text-4xl md:text-5xl font-bold leading-tight ${fontFamilyClass}`}
          style={{ color: form.textColor }}
        >
          {form.welcomeTitle || 'Welcome!'}
        </h1>
        <p
          className={`text-lg opacity-70 ${fontFamilyClass}`}
          style={{ color: form.textColor }}
        >
          {form.welcomeMessage || 'Thanks for taking the time to fill this out.'}
        </p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            size="lg"
            className="gap-2 rounded-full px-10 h-12 text-base font-medium"
            style={{
              backgroundColor: form.buttonColor,
              color: form.buttonTextColor,
            }}
          >
            Start
            <ArrowLeft className="size-4 rotate-180" />
          </Button>
        </motion.div>
      </motion.div>

      {/* Progress indicator */}
      {form.progressbar && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
          <div className="h-full w-0" style={{ backgroundColor: form.buttonColor }} />
        </div>
      )}
    </div>
  );
}
