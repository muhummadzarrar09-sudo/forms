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
import { BuilderFormPreview } from '@/components/forms/builder-form-preview';
import { deriveFormTheme } from '@/lib/form-theme';
import { QuestionTypePicker } from '@/components/forms/question-type-picker';
import { DesignPanel } from '@/components/forms/design-panel';
import { ShareDialog } from '@/components/forms/share-dialog';
import { KeyboardShortcuts } from '@/components/forms/keyboard-shortcuts';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Download,
  Keyboard,
  Heart,
  Pencil,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getQuestionTypeColor } from '@/lib/constants';

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
function useDebounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  // Mobile begins with a clear canvas; the inspector opens automatically on desktop.
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const syncInspector = () => setShowRightPanel(media.matches);
    syncInspector();
    media.addEventListener('change', syncInspector);
    return () => media.removeEventListener('change', syncInspector);
  }, []);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showAssetSetupDialog, setShowAssetSetupDialog] = useState(false);
  const [showEndingScreen, setShowEndingScreen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<'editor' | 'preview'>('editor');
  const [formTitle, setFormTitle] = useState('');
  const [isEditingFormTitle, setIsEditingFormTitle] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved' | 'error'>('idle');

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
      setSaveFeedback('idle');
      try {
        const res = await fetch(`/api/forms/${currentForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const saved = await res.json();
          setCurrentForm(saved);
          setSaveFeedback('saved');
        } else {
          setSaveFeedback('error');
        }
      } catch {
        setSaveFeedback('error');
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
      settings: q.settings, logic: q.logic, placeholder: q.placeholder
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
        setSaveFeedback('saved');
      } else {
        lastSavedHashRef.current = ''; // Reset on failure to allow retry
        setSaveFeedback('error');
      }
    } catch {
      lastSavedHashRef.current = ''; // Reset on failure to allow retry
      setSaveFeedback('error');
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
    setSaveFeedback('idle');
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

  const assetContactSetupQuestion = useMemo(() => sortedQuestions.find((question) =>
    question.settings.requiresAssetContactSetup && /\[your (WhatsApp|Instagram)/i.test(question.description)
  ) || null, [sortedQuestions]);

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
    if (!currentForm.published && assetContactSetupQuestion) {
      setShowAssetSetupDialog(true);
      return;
    }
    const newPublished = !currentForm.published;
    updateForm(currentForm.id, { published: newPublished });
    await saveFormSettings({ published: newPublished });
    toast({
      title: newPublished ? 'Form published' : 'Form unpublished',
      description: newPublished
        ? 'Your form is now live and accepting responses.'
        : 'Your form is now in draft mode.',
    });
  }, [currentForm, assetContactSetupQuestion, updateForm, saveFormSettings]);

  // ── Export JSON ──
  const handleExportJSON = useCallback(() => {
    if (!currentForm) return;
    const exportData = {
      version: 1,
      title: currentForm.title,
      description: currentForm.description,
      welcomeTitle: currentForm.welcomeTitle || '',
      welcomeMessage: currentForm.welcomeMessage || '',
      endingTitle: currentForm.endingTitle || '',
      endingMessage: currentForm.endingMessage || '',
      theme: currentForm.theme || 'default',
      backgroundColor: currentForm.backgroundColor,
      textColor: currentForm.textColor,
      buttonColor: currentForm.buttonColor,
      buttonTextColor: currentForm.buttonTextColor,
      fontFamily: currentForm.fontFamily || 'sans',
      progressbar: currentForm.progressbar ?? true,
      showQuestionNumbers: currentForm.showQuestionNumbers ?? true,
      allowBackNavigation: currentForm.allowBackNavigation ?? true,
      questions: (currentForm.questions || []).map((q) => ({
        type: q.type,
        title: q.title,
        description: q.description || '',
        required: q.required,
        options: (q.options || []).map((opt) => ({ id: opt.id, label: opt.label })),
        settings: q.settings || {},
        placeholder: q.placeholder || '',
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentForm.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Form exported',
      description: `"${currentForm.title}" has been exported as JSON.`,
    });
  }, [currentForm]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Escape - Back to dashboard
      if (e.key === 'Escape' && !isInputFocused) {
        // Only if no dialog is open
        if (!showTypePicker && !showShareDialog && !showKeyboardShortcuts) {
          openDashboard();
          return;
        }
      }

      // + or = - Add new question
      if ((e.key === '+' || e.key === '=') && !isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowTypePicker(true);
        return;
      }

      // Delete or Backspace - Delete selected question
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused && selectedQuestionId && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleDeleteQuestion(selectedQuestionId);
        return;
      }

      // Ctrl+S / Cmd+S - Save (prevent default)
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // Trigger save by resetting the hash to force re-save
        lastSavedHashRef.current = '';
        if (currentForm) {
          saveQuestions(currentForm.questions);
        }
        toast({ title: 'Form saved', description: 'All changes have been saved.' });
        return;
      }

      // Ctrl+P / Cmd+P - Toggle embedded preview without leaving the builder.
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setWorkspaceMode((mode) => mode === 'editor' ? 'preview' : 'editor');
        return;
      }

      // ? - Show keyboard shortcuts
      if (e.key === '?' && !isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTypePicker, showShareDialog, showKeyboardShortcuts, openDashboard, selectedQuestionId, handleDeleteQuestion, currentForm, saveQuestions, openFiller]);

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

  const editorTheme = deriveFormTheme(currentForm);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="h-16 border-b bg-background/95 backdrop-blur-sm flex items-center px-3 gap-1.5 shrink-0 z-20">
        {/* Back */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11" onClick={openDashboard} aria-label="Back to dashboard">
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
          className="size-11 md:hidden"
          onClick={() => setShowLeftPanel(!showLeftPanel)}
          aria-label={showLeftPanel ? 'Close question list' : 'Open question list'}
        >
          <Menu className="size-4" />
        </Button>

        <Separator orientation="vertical" className="h-5" />

        {/* Form title */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
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
          {/* Favorite toggle */}
          <button
            onClick={async () => {
              const newFavorite = !currentForm.favorite;
              updateForm(currentForm.id, { favorite: newFavorite });
              await saveFormSettings({ favorite: newFavorite });
              toast({
                title: newFavorite ? 'Added to favorites' : 'Removed from favorites',
                description: newFavorite
                  ? `"${currentForm.title}" is now a favorite.`
                  : `"${currentForm.title}" is no longer a favorite.`,
              });
            }}
            className={`hidden size-11 shrink-0 items-center justify-center rounded-full transition-all sm:flex ${
              currentForm.favorite
                ? 'text-rose-600 hover:bg-rose-500/10'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            aria-label={currentForm.favorite ? 'Remove from favorites' : 'Add to favorites'}
            title={currentForm.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`size-4 ${currentForm.favorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Workspace mode: embedded local preview prevents the builder from becoming congested. */}
        <div className="hidden items-center rounded-lg border bg-muted/40 p-0.5 sm:flex" role="tablist" aria-label="Builder workspace mode">
          <Button
            type="button"
            size="sm"
            variant={workspaceMode === 'editor' ? 'secondary' : 'ghost'}
            className="min-h-10 gap-1.5 px-2.5 text-xs"
            role="tab"
            aria-selected={workspaceMode === 'editor'}
            onClick={() => setWorkspaceMode('editor')}
          >
            <Pencil className="size-3.5" /> Editor
          </Button>
          <Button
            type="button"
            size="sm"
            variant={workspaceMode === 'preview' ? 'secondary' : 'ghost'}
            className="min-h-10 gap-1.5 px-2.5 text-xs"
            role="tab"
            aria-selected={workspaceMode === 'preview'}
            onClick={() => setWorkspaceMode('preview')}
          >
            <Eye className="size-3.5" /> Preview
          </Button>
        </div>

        <span className="hidden items-center gap-1.5 text-xs sm:flex" aria-live="polite">
          {isSaving ? (
            <><span className="size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /><span className="text-muted-foreground">Saving…</span></>
          ) : saveFeedback === 'error' ? (
            <><span className="size-2 rounded-full bg-destructive" /><span className="text-destructive">Save failed</span></>
          ) : saveFeedback === 'saved' ? (
            <><Check className="size-3.5 text-success" /><span className="text-success">Saved</span></>
          ) : (
            <span className="text-muted-foreground">Draft</span>
          )}
        </span>

        <Separator orientation="vertical" className="h-5" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {/* Toggle right panel on mobile */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`hidden size-11 sm:inline-flex lg:hidden ${workspaceMode === 'preview' ? 'invisible pointer-events-none' : ''}`}
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  aria-label={showRightPanel ? 'Close settings panel' : 'Open settings panel'}
                >
                  <Settings2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle settings panel</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:hidden"
                  onClick={() => setWorkspaceMode((mode) => mode === 'editor' ? 'preview' : 'editor')}
                  aria-label={workspaceMode === 'editor' ? 'Switch to embedded preview' : 'Switch to editor'}
                >
                  {workspaceMode === 'editor' ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{workspaceMode === 'editor' ? 'Preview' : 'Editor'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 gap-1.5 text-xs hidden sm:flex"
                  onClick={() => setShowShareDialog(true)}
                >
                  <Share2 className="size-3.5" />
                  Share
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share your form</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 gap-1.5 text-xs hidden sm:flex"
                  onClick={() => openFiller(currentForm.id)}
                >
                  <Eye className="size-3.5" />
                  Test form
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open the full respondent test experience</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-5 hidden sm:block" />

          <motion.div
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Button
              size="sm"
              className={`min-h-11 min-w-11 gap-1.5 text-xs transition-colors duration-300 ${currentForm.published ? 'bg-success text-success-foreground hover:bg-success/90' : ''}`}
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
          </motion.div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-11 sm:inline-flex"
                  onClick={() => setShowKeyboardShortcuts(true)}
                >
                  <Keyboard className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11">
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
                Test form
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
              <DropdownMenuItem onClick={handleExportJSON}>
                <Download className="size-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowKeyboardShortcuts(true)}>
                <Keyboard className="size-4 mr-2" />
                Keyboard shortcuts
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
        {workspaceMode === 'editor' && showLeftPanel && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setShowLeftPanel(false)}
          />
        )}

        {/* ── Left Panel: Question List ── */}
        <div className={`w-64 border-r bg-muted/30 flex flex-col shrink-0 z-40 transition-transform duration-200 ${
          workspaceMode === 'preview' ? 'hidden' : showLeftPanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } fixed md:relative h-[calc(100vh-4rem)] md:h-auto`}>
          {/* Welcome Screen item */}
          <div className="px-3 pt-3 pb-0.5">
            <button
              onClick={() => {
                setSelectedQuestionId(null);
                setShowEndingScreen(false);
                setShowLeftPanel(false);
              }}
              className={`w-full flex min-h-11 items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-sm transition-all ${
                !selectedQuestionId && !showEndingScreen
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <div className={`size-7 rounded flex items-center justify-center shrink-0 ${
                !selectedQuestionId && !showEndingScreen ? 'bg-primary/10' : 'bg-muted'
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
                        setShowEndingScreen(false);
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
          <div className="px-3 py-2 border-t">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                className="min-h-11 w-full gap-1.5 text-xs border-dashed hover:border-primary/50 hover:bg-primary/5 group/btn"
                onClick={() => setShowTypePicker(true)}
              >
                <Plus className="size-3.5 transition-colors group-hover/btn:text-primary" />
                Add question
              </Button>
            </motion.div>
          </div>

          {/* Ending Screen item */}
          <div className="px-3 pb-3 pt-0.5">
            <button
              onClick={() => {
                setSelectedQuestionId(null);
                setShowEndingScreen(true);
                setShowLeftPanel(false);
              }}
              className={`w-full flex min-h-11 items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-sm transition-all ${
                showEndingScreen
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <div className={`size-7 rounded flex items-center justify-center shrink-0 ${
                showEndingScreen ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <HandMetal className="size-3.5" />
              </div>
              <span className="truncate">Ending Screen</span>
            </button>
          </div>
        </div>

        {/* ── Center Panel: Question Editor / Preview ── */}
        <div className={`flex-1 overflow-hidden min-w-0 ${workspaceMode === 'preview' ? '' : 'bg-muted/20'}`}>
          {workspaceMode === 'preview' ? (
            <BuilderFormPreview form={currentForm} />
          ) : selectedQuestion ? (
            <QuestionEditor
              key={selectedQuestion.id}
              question={selectedQuestion}
              questionIndex={sortedQuestions.findIndex((q) => q.id === selectedQuestion.id)}
              totalQuestions={sortedQuestions.length}
              formBackgroundColor={editorTheme.backgroundColor}
              formTextColor={editorTheme.textColor}
              formButtonColor={editorTheme.buttonColor}
              formButtonTextColor={editorTheme.buttonTextColor}
              formFontFamily={editorTheme.fontFamily}
            />
          ) : showEndingScreen ? (
            /* Ending Screen editor */
            <EndingScreenEditor form={currentForm} />
          ) : sortedQuestions.length === 0 ? (
            /* Empty state - no questions */
            <EmptyQuestionsState onAddQuestion={() => setShowTypePicker(true)} />
          ) : (
            /* Welcome Screen preview */
            <WelcomeScreenPreview form={currentForm} />
          )}
        </div>

        {/* ── Right Panel: Settings / Design ── */}
        <AnimatePresence>
          {workspaceMode === 'editor' && showRightPanel && (
            <>
              {/* Mobile overlay for right panel */}
              <div
                className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                onClick={() => setShowRightPanel(false)}
              />
              <motion.div
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="fixed right-0 top-16 bottom-0 w-[320px] z-40 lg:relative lg:top-auto lg:bottom-auto lg:shrink-0 border-l bg-background"
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

      <AlertDialog open={showAssetSetupDialog} onOpenChange={setShowAssetSetupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish your asset fallback contact details</AlertDialogTitle>
            <AlertDialogDescription>
              This imported form still contains WhatsApp/Instagram placeholders for people who cannot share an asset link. Add your own contact details before publishing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!assetContactSetupQuestion) return;
                setWorkspaceMode('editor');
                setShowRightPanel(true);
                setShowEndingScreen(false);
                setSelectedQuestionId(assetContactSetupQuestion.id);
              }}
            >
              Take me to the question
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={async () => {
                if (!currentForm) return;
                updateForm(currentForm.id, { published: true });
                await saveFormSettings({ published: true });
                toast({ title: 'Form published with asset placeholders', description: 'Remember to update the fallback contact details.' });
              }}
            >
              Publish anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        form={currentForm}
        onPublish={handlePublish}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcuts
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
        context="builder"
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
        className={`group flex min-h-11 items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all relative hover:translate-x-0.5 ${
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
          className="flex size-10 shrink-0 cursor-grab items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>

        {/* Question number */}
        <span
          className={`size-6 rounded text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
            isSelected ? 'bg-primary/30 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {index + 1}
        </span>

        {/* Icon */}
        <IconComponent className="size-3.5 shrink-0 opacity-60" />

        {/* Type category dot */}
        <span className={`size-2 rounded-full shrink-0 ${getQuestionTypeColor(question.type)}`} />

        {/* Title */}
        <span className="flex-1 text-sm truncate">{question.title}</span>

        {/* Actions on hover */}
        <div className="flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex size-10 items-center justify-center rounded-md hover:bg-accent"
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

// ── Welcome Screen Preview (Interactive Editor) ──────────────────────────────

function WelcomeScreenPreview({ form }: { form: Form }) {
  const { updateForm } = useFormStore();
  const theme = deriveFormTheme(form);
  const fontFamilyClass =
    form.fontFamily === 'serif'
      ? 'font-serif'
      : form.fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const [localTitle, setLocalTitle] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState('Start');
  const [editingField, setEditingField] = useState<'title' | 'message' | 'button' | null>(null);

  // Use local state if editing, otherwise use form state
  const welcomeTitle = localTitle !== null ? localTitle : (form.welcomeTitle || '');
  const welcomeMessage = localMessage !== null ? localMessage : (form.welcomeMessage || '');

  const saveToApi = async (updates: Record<string, string>) => {
    try {
      await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch { /* silent */ }
  };

  const handleTitleBlur = () => {
    setEditingField(null);
    if (localTitle !== null && localTitle !== (form.welcomeTitle || '')) {
      updateForm(form.id, { welcomeTitle: localTitle });
      saveToApi({ welcomeTitle: localTitle });
    }
    setLocalTitle(null);
  };

  const handleMessageBlur = () => {
    setEditingField(null);
    if (localMessage !== null && localMessage !== (form.welcomeMessage || '')) {
      updateForm(form.id, { welcomeMessage: localMessage });
      saveToApi({ welcomeMessage: localMessage });
    }
    setLocalMessage(null);
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 py-12 h-full relative overflow-hidden"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-100"
        style={{
          background: `linear-gradient(135deg, ${theme.selectedSurfaceColor}, ${theme.backgroundColor}, ${theme.controlSurfaceColor})`,
          backgroundSize: '200% 200%',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="text-center max-w-lg space-y-6"
      >
        {/* Editable Title */}
        {editingField === 'title' ? (
          <textarea
            value={welcomeTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTitleBlur();
              }
            }}
            autoFocus
            className={`text-4xl md:text-5xl font-bold leading-tight bg-transparent border-b-2 border-dashed outline-none resize-none text-center w-full ${fontFamilyClass}`}
            style={{ color: theme.textColor, borderColor: theme.fieldBorderColor }}
            rows={2}
          />
        ) : (
          <h1
            onClick={() => setEditingField('title')}
            className={`text-4xl md:text-5xl font-bold leading-tight cursor-pointer rounded-lg px-2 -mx-2 transition-all hover:opacity-85 ${fontFamilyClass}`}
            style={{ color: theme.textColor }}
            title="Click to edit"
          >
            {welcomeTitle || 'Welcome!'}

          </h1>
        )}

        {/* Editable Message */}
        {editingField === 'message' ? (
          <textarea
            value={welcomeMessage}
            onChange={(e) => setLocalMessage(e.target.value)}
            onBlur={handleMessageBlur}
            autoFocus
            className={`text-lg bg-transparent border-b-2 border-dashed outline-none resize-none text-center w-full ${fontFamilyClass}`}
            style={{ color: theme.textColor, borderColor: theme.fieldBorderColor }}
            rows={3}
          />
        ) : (
          <p
            onClick={() => setEditingField('message')}
            className={`text-lg cursor-pointer rounded-lg px-2 -mx-2 transition-all hover:opacity-85 ${fontFamilyClass}`}
            style={{ color: theme.textColor }}
            title="Click to edit"
          >
            {welcomeMessage || 'Thanks for taking the time to fill this out.'}

          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Editable Button */}
          {editingField === 'button' ? (
            <input
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingField(null);
              }}
              autoFocus
              className="text-base font-medium bg-transparent border-b-2 border-dashed outline-none text-center"
              style={{ color: theme.buttonTextColor, borderColor: theme.fieldBorderColor }}
            />
          ) : (
            <Button
              size="lg"
              className="gap-2 rounded-full px-10 h-12 text-base font-medium cursor-pointer"
              style={{
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor,
              }}
              onClick={() => setEditingField('button')}
            >
              {buttonText || 'Start'}
              <ArrowLeft className="size-4 rotate-180" />
            </Button>
          )}
        </motion.div>
      </motion.div>

      {/* Edit hint overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2"
      >
        <p className="text-xs" style={{ color: theme.textTertiaryColor }}>
          Click any element to edit
        </p>
      </motion.div>

      {/* Progress indicator */}
      {form.progressbar && (
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: theme.trackColor }}>
          <div className="h-full w-0" style={{ backgroundColor: theme.buttonColor }} />
        </div>
      )}
    </div>
  );
}

// ── Ending Screen Editor (Interactive) ────────────────────────────────────────

function EndingScreenEditor({ form }: { form: Form }) {
  const { updateForm } = useFormStore();
  const theme = deriveFormTheme(form);
  const fontFamilyClass =
    form.fontFamily === 'serif'
      ? 'font-serif'
      : form.fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const [localTitle, setLocalTitle] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'message' | null>(null);

  const endingTitle = localTitle !== null ? localTitle : (form.endingTitle || '');
  const endingMessage = localMessage !== null ? localMessage : (form.endingMessage || '');

  const saveToApi = async (updates: Record<string, string>) => {
    try {
      await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch { /* silent */ }
  };

  const handleTitleBlur = () => {
    setEditingField(null);
    if (localTitle !== null && localTitle !== (form.endingTitle || '')) {
      updateForm(form.id, { endingTitle: localTitle });
      saveToApi({ endingTitle: localTitle });
    }
    setLocalTitle(null);
  };

  const handleMessageBlur = () => {
    setEditingField(null);
    if (localMessage !== null && localMessage !== (form.endingMessage || '')) {
      updateForm(form.id, { endingMessage: localMessage });
      saveToApi({ endingMessage: localMessage });
    }
    setLocalMessage(null);
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 py-12 h-full relative"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="text-center max-w-lg space-y-6"
      >
        {/* Checkmark animation preview */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="mx-auto size-24 rounded-full flex items-center justify-center"
          style={{ backgroundColor: theme.buttonColor }}
        >
          <Check className="size-12" style={{ color: theme.buttonTextColor }} />
        </motion.div>

        {/* Editable Title */}
        {editingField === 'title' ? (
          <textarea
            value={endingTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTitleBlur();
              }
            }}
            autoFocus
            className={`text-4xl md:text-5xl font-bold leading-tight bg-transparent border-b-2 border-dashed outline-none resize-none text-center w-full ${fontFamilyClass}`}
            style={{ color: theme.textColor, borderColor: theme.fieldBorderColor }}
            rows={2}
          />
        ) : (
          <h1
            onClick={() => setEditingField('title')}
            className={`text-4xl md:text-5xl font-bold leading-tight cursor-pointer rounded-lg px-2 -mx-2 transition-all hover:opacity-85 ${fontFamilyClass}`}
            style={{ color: theme.textColor }}
            title="Click to edit"
          >
            {endingTitle || 'Thank you!'}

          </h1>
        )}

        {/* Editable Message */}
        {editingField === 'message' ? (
          <textarea
            value={endingMessage}
            onChange={(e) => setLocalMessage(e.target.value)}
            onBlur={handleMessageBlur}
            autoFocus
            className={`text-lg bg-transparent border-b-2 border-dashed outline-none resize-none text-center w-full ${fontFamilyClass}`}
            style={{ color: theme.textColor, borderColor: theme.fieldBorderColor }}
            rows={3}
          />
        ) : (
          <p
            onClick={() => setEditingField('message')}
            className={`text-lg md:text-xl cursor-pointer rounded-lg px-2 -mx-2 transition-all hover:opacity-85 ${fontFamilyClass}`}
            style={{ color: theme.textColor }}
            title="Click to edit"
          >
            {endingMessage || 'Your response has been recorded.'}

          </p>
        )}

        {/* Progress at 100% if showQuestionNumbers is on */}
        {form.showQuestionNumbers && form.progressbar && (
          <div className="w-full max-w-xs mx-auto">
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: theme.trackColor }}>
              <div
                className="h-full w-full rounded-full"
                style={{ backgroundColor: theme.buttonColor }}
              />
            </div>
            <p className="mt-1 text-xs" style={{ color: theme.textTertiaryColor }}>
              100% complete
            </p>
          </div>
        )}
      </motion.div>

      {/* Edit hint overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2"
      >
        <p className="text-xs" style={{ color: theme.textTertiaryColor }}>
          Click any element to edit
        </p>
      </motion.div>

      {/* Progress bar at 100% */}
      {form.progressbar && (
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: theme.trackColor }}>
          <div
            className="h-full w-full"
            style={{ backgroundColor: theme.buttonColor }}
          />
        </div>
      )}
    </div>
  );
}

// ── Empty Questions State ────────────────────────────────────────────────────

function EmptyQuestionsState({ onAddQuestion }: { onAddQuestion: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 h-full bg-muted/20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="text-center space-y-6 max-w-md"
      >
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border bg-primary/5 shadow-[var(--shadow-1)]">
          <Plus className="size-10 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold">Add your first question</h2>
          <p className="text-sm text-muted-foreground">
            Start building your form by adding questions. Choose from 16 different question types
            like multiple choice, text input, rating scales, and more.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">Choose a type to begin building the flow.</p>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Button
            size="lg"
            className="gap-2 rounded-full px-8 h-12 text-base font-medium"
            onClick={onAddQuestion}
          >
            <Plus className="size-5" />
            Add Question
          </Button>
        </motion.div>

        <p className="text-xs text-muted-foreground">
          or press the &ldquo;Add question&rdquo; button in the left panel
        </p>
      </motion.div>
    </div>
  );
}
