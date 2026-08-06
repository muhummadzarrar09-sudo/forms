'use client';

import { useEffect, useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormStore } from '@/store/form-store';
import type { Form, Workspace } from '@/types/form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  FileText,
  LayoutGrid,
  List,
  Search,
  SortAsc,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Users,
  Check,
  LucideIcon,
  Sun,
  Moon,
  Monitor,
  Upload,
  Keyboard,
  Heart,
  Archive,
  Pencil,
  Globe,
  ChevronDown,
  ChevronRight,
  Home,
  Palette,
  BookOpen,
  Layers,
  ChevronLeft,
  Menu,
  X,
  FolderOpen,
  Trash2,
  MoreHorizontal,
  Folder,
} from 'lucide-react';
import {
  MessageSquare,
  Calendar,
  Mail,
  ShoppingCart,
  Briefcase,
  GraduationCap,
  Newspaper,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormCard } from '@/components/forms/form-card';
import { BrandMark } from '@/components/brand-mark';
import { KeyboardShortcuts } from '@/components/forms/keyboard-shortcuts';
import { NotificationBell } from '@/components/forms/notification-bell';
import { FORM_TEMPLATES, type FormTemplate } from '@/lib/form-helpers';
import { convertCatalogIntake } from '@/lib/catalog-intake-import';

type SortOption = 'newest' | 'oldest' | 'title' | 'responses';
type FilterOption = 'all' | 'favorites' | 'archived';

// Time ago helper
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

// Animated counter hook
function useAnimatedCounter(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    if (target === prevTargetRef.current) return;
    const start = prevTargetRef.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let rafId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    prevTargetRef.current = target;

    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return count;
}

// Staggered animation variants for form cards
const cardContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Icon mapping for templates
const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare,
  Calendar,
  Users,
  Mail,
  ShoppingCart,
  Briefcase,
  GraduationCap,
  Newspaper,
  FileText,
};

const TEMPLATE_ACCENTS: Record<string, string> = {
  Leads: '#1D4ED8',
  'Client intake': '#0F766E',
  Feedback: '#6D28D9',
  Events: '#B45309',
  HR: '#BE123C',
  Commerce: '#1D4ED8',
  Assessments: '#6D28D9',
};

function templateAccent(template: FormTemplate): string {
  return TEMPLATE_ACCENTS[template.category || ''] || '#1D4ED8';
}

// Activity type icons and labels
function getActivityInfo(form: Form): { type: string; label: string; Icon: LucideIcon } {
  if (form.published) {
    const createdRecently = (Date.now() - new Date(form.createdAt).getTime()) < 24 * 60 * 60 * 1000;
    if (createdRecently) {
      return { type: 'published', label: 'published', Icon: Globe };
    }
  }
  if ((form._count?.responses ?? 0) > 0) {
    const updatedRecently = (Date.now() - new Date(form.updatedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
    if (updatedRecently) {
      return { type: 'response', label: 'received a response', Icon: Users };
    }
  }
  const createdVeryRecently = (Date.now() - new Date(form.createdAt).getTime()) < 60 * 60 * 1000;
  if (createdVeryRecently) {
    return { type: 'created', label: 'created', Icon: Plus };
  }
  return { type: 'edited', label: 'edited', Icon: Pencil };
}

export function Dashboard() {
  const {
    forms,
    isLoading,
    setIsLoading,
    setForms,
    addForm,
    removeForm,
    updateForm,
    openBuilder,
    openFiller,
    openResponses,
    workspaces,
    setWorkspaces,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    checkForNewResponses,
  } = useFormStore();

  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const displayName = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || 'Account';
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [showNewFormDialog, setShowNewFormDialog] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDescription, setNewFormDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showResourcesDialog, setShowResourcesDialog] = useState(false);

  // Workspace state
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState('#2563EB');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [workspaceMenuId, setWorkspaceMenuId] = useState<string | null>(null);
  const [newFormWorkspaceId, setNewFormWorkspaceId] = useState<string | null>(null);

  // Template picker state
  const [dialogStep, setDialogStep] = useState<'template' | 'details'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // Keyboard shortcuts state
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gKeyBufferRef = useRef(false);
  const gKeyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch forms and workspaces on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [formsRes, workspacesRes] = await Promise.all([
          fetch('/api/forms'),
          fetch('/api/workspaces'),
        ]);
        if (formsRes.ok) {
          const data = await formsRes.json();
          setForms(data);
        } else {
          toast({
            title: 'Error loading forms',
            description: 'Could not fetch your forms. Please try again.',
            variant: 'destructive',
          });
        }
        if (workspacesRes.ok) {
          const wsData = await workspacesRes.json();
          setWorkspaces(wsData);
        }
      } catch {
        toast({
          title: 'Network error',
          description: 'Could not connect to the server.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [setForms, setWorkspaces, setIsLoading]);

  // Check for new response notifications after forms are loaded
  useEffect(() => {
    if (forms.length > 0 && !isLoading) {
      checkForNewResponses();
    }
  }, [forms.length, isLoading, checkForNewResponses]);

  // Count for each filter
  const filterCounts = useMemo(() => ({
    all: forms.filter((f) => !f.archived).length,
    favorites: forms.filter((f) => f.favorite && !f.archived).length,
    archived: forms.filter((f) => f.archived).length,
  }), [forms]);

  // Filter and sort forms
  const filteredForms = useMemo(() => {
    let result = [...forms];

    // Apply workspace filter
    if (activeWorkspaceId) {
      result = result.filter((f) => f.workspaceId === activeWorkspaceId);
    }

    // Apply filter
    if (activeFilter === 'all') {
      result = result.filter((f) => !f.archived);
    } else if (activeFilter === 'favorites') {
      result = result.filter((f) => f.favorite && !f.archived);
    } else if (activeFilter === 'archived') {
      result = result.filter((f) => f.archived);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query) ||
          (f.tags || []).some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'oldest':
        result.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'responses':
        result.sort(
          (a, b) =>
            (b._count?.responses ?? 0) - (a._count?.responses ?? 0)
        );
        break;
    }

    return result;
  }, [forms, searchQuery, sortBy, activeFilter, activeWorkspaceId]);

  // Stats
  const totalForms = forms.filter((f) => !f.archived).length;
  const publishedForms = forms.filter((f) => f.published && !f.archived).length;
  const totalResponses = forms.reduce(
    (acc, f) => acc + (f._count?.responses ?? 0),
    0
  );

  // Animated counters
  const animatedTotalForms = useAnimatedCounter(totalForms);
  const animatedPublishedForms = useAnimatedCounter(publishedForms);
  const animatedTotalResponses = useAnimatedCounter(totalResponses);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Recent activity items (derived from form data)
  const recentActivity = useMemo(() => {
    const sorted = [...forms]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
    return sorted.map((form) => {
      const activity = getActivityInfo(form);
      return {
        formId: form.id,
        formTitle: form.title,
        activityType: activity.type,
        activityLabel: activity.label,
        Icon: activity.Icon,
        timestamp: form.updatedAt || form.createdAt,
        timeAgoText: timeAgo(form.updatedAt || form.createdAt),
      };
    });
  }, [forms]);

  // Workspace form count helper
  const getWorkspaceFormCount = useCallback((workspaceId: string) => {
    return forms.filter((f) => f.workspaceId === workspaceId && !f.archived).length;
  }, [forms]);

  // Create workspace
  const handleCreateWorkspace = useCallback(async () => {
    if (!newWorkspaceName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a workspace name.', variant: 'destructive' });
      return;
    }
    setIsCreatingWorkspace(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName.trim(), color: newWorkspaceColor }),
      });
      if (res.ok) {
        const workspace = await res.json();
        addWorkspace(workspace);
        setShowCreateWorkspaceDialog(false);
        setNewWorkspaceName('');
        setNewWorkspaceColor('#2563EB');
        toast({ title: 'Workspace created', description: `"${workspace.name}" is ready.` });
      } else {
        toast({ title: 'Error', description: 'Failed to create workspace.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setIsCreatingWorkspace(false);
    }
  }, [newWorkspaceName, newWorkspaceColor, addWorkspace]);

  // Delete workspace
  const handleDeleteWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
      if (res.ok) {
        removeWorkspace(workspaceId);
        if (activeWorkspaceId === workspaceId) {
          setActiveWorkspaceId(null);
        }
        toast({ title: 'Workspace deleted' });
      }
    } catch {
      toast({ title: 'Failed to delete workspace', variant: 'destructive' });
    }
  }, [activeWorkspaceId, removeWorkspace]);

  // Move form to workspace
  const handleMoveToWorkspace = useCallback(async (formId: string, workspaceId: string | null) => {
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        const ws = workspaceId ? workspaces.find(w => w.id === workspaceId) : null;
        updateForm(formId, { workspaceId, workspace: ws ? { id: ws.id, name: ws.name, color: ws.color, icon: ws.icon, order: ws.order, userId: ws.userId, createdAt: ws.createdAt, updatedAt: ws.updatedAt } : null });
        toast({ title: workspaceId ? `Moved to ${ws?.name || 'workspace'}` : 'Removed from workspace' });
      }
    } catch {
      toast({ title: 'Failed to move form', variant: 'destructive' });
    }
  }, [workspaces, updateForm]);

  // Reset dialog state when opening
  const handleOpenNewFormDialog = useCallback(() => {
    setDialogStep('template');
    setSelectedTemplateId(null);
    setNewFormTitle('');
    setNewFormDescription('');
    setNewFormWorkspaceId(activeWorkspaceId);
    setShowNewFormDialog(true);
  }, [activeWorkspaceId]);

  // Select template and go to details step
  const handleSelectTemplate = useCallback((templateId: string | null) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = FORM_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        setNewFormTitle(template.title);
        setNewFormDescription(template.description);
      }
    } else {
      setNewFormTitle('');
      setNewFormDescription('');
    }
    setDialogStep('details');
  }, []);

  // Open a template from the dedicated Templates destination.
  const handleStartFromTemplate = useCallback((templateId: string) => {
    const template = FORM_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(template.id);
    setNewFormTitle(template.title);
    setNewFormDescription(template.description);
    setNewFormWorkspaceId(activeWorkspaceId);
    setDialogStep('details');
    setShowNewFormDialog(true);
  }, [activeWorkspaceId]);

  // Create new form with optional template
  const handleCreateForm = useCallback(async () => {
    if (!newFormTitle.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for your form.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newFormTitle.trim(),
          description: newFormDescription.trim(),
          workspaceId: newFormWorkspaceId || undefined,
        }),
      });

      if (res.ok) {
        const createdForm = await res.json();
        addForm(createdForm);

        // If a template is selected, add the template questions
        const selectedTemplate = selectedTemplateId
          ? FORM_TEMPLATES.find((t) => t.id === selectedTemplateId)
          : null;

        if (selectedTemplate && selectedTemplate.questions.length > 0) {
          try {
            const questionsPayload = selectedTemplate.questions.map(
              (q, index) => ({
                // Stable client IDs allow question logic to reference questions in this atomic save.
                id: `temp_template_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
                type: q.type,
                title: q.title,
                description: q.description || '',
                required: q.required || false,
                order: index,
                options: q.options
                  ? q.options.map((label, optIdx) => ({
                      id: `opt_${Date.now()}_${optIdx}`,
                      label,
                    }))
                  : [],
                imageUrls: [],
                settings: q.settings || {},
                placeholder: q.placeholder || '',
              })
            );

            await fetch(`/api/forms/${createdForm.id}/questions`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questions: questionsPayload }),
            });
          } catch {
            // Questions creation failed, but form was created
            console.error('Failed to add template questions');
          }
        }

        setShowNewFormDialog(false);
        setNewFormTitle('');
        setNewFormDescription('');
        setSelectedTemplateId(null);
        toast({
          title: 'Form created',
          description: `"${createdForm.title}" is ready to edit.`,
        });
        // Open the builder for the new form
        openBuilder(createdForm.id);
      } else {
        toast({
          title: 'Error creating form',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not connect to the server.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }, [newFormTitle, newFormDescription, selectedTemplateId, addForm, openBuilder]);

  // Delete form
  const handleDeleteForm = useCallback(
    async (formId: string) => {
      try {
        const res = await fetch(`/api/forms/${formId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          removeForm(formId);
        } else {
          toast({
            title: 'Error deleting form',
            description: 'Could not delete the form. Please try again.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Network error',
          description: 'Could not connect to the server.',
          variant: 'destructive',
        });
      }
    },
    [removeForm]
  );

  // Update form title
  const handleTitleUpdate = useCallback(
    async (formId: string, title: string) => {
      try {
        const res = await fetch(`/api/forms/${formId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          updateForm(formId, { title });
        } else {
          toast({
            title: 'Error updating title',
            description: 'Could not update the form title.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Network error',
          variant: 'destructive',
        });
      }
    },
    [updateForm]
  );

  // Sort label
  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest first',
    oldest: 'Oldest first',
    title: 'Alphabetical',
    responses: 'Most responses',
  };

  // ── Import Form ──
  const validateImportJson = (json: unknown): { valid: boolean; error: string } => {
    if (!json || typeof json !== 'object') {
      return { valid: false, error: 'Invalid JSON: expected an object.' };
    }
    const obj = json as Record<string, unknown>;
    if (!obj.title || typeof obj.title !== 'string') {
      return { valid: false, error: 'Invalid JSON: "title" is required and must be a string.' };
    }
    if (!obj.questions || !Array.isArray(obj.questions)) {
      return { valid: false, error: 'Invalid JSON: "questions" must be an array.' };
    }
    for (let i = 0; i < obj.questions.length; i++) {
      const q = obj.questions[i] as Record<string, unknown>;
      if (!q.type || typeof q.type !== 'string') {
        return { valid: false, error: `Invalid JSON: question ${i + 1} must have a "type" string.` };
      }
      if (!q.title || typeof q.title !== 'string') {
        return { valid: false, error: `Invalid JSON: question ${i + 1} must have a "title" string.` };
      }
    }
    return { valid: true, error: '' };
  };

  const handleImportForm = useCallback(async () => {
    setImportError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJsonText);
    } catch {
      setImportError('Invalid JSON syntax. Please check your input and try again.');
      return;
    }

    const validation = validateImportJson(parsed);
    if (!validation.valid) {
      setImportError(validation.error);
      return;
    }

    const data = parsed as Record<string, unknown>;
    const catalogImport = convertCatalogIntake(parsed);
    const normalizedForm = catalogImport?.form;
    const normalizedQuestions = catalogImport?.questions;
    setImportWarnings(catalogImport?.warnings || []);
    setIsImporting(true);
    try {
      // Create the form
      const formRes = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: normalizedForm?.title || data.title,
          description: normalizedForm?.description || data.description || '',
          welcomeTitle: normalizedForm?.welcomeTitle || data.welcomeTitle || '',
          welcomeMessage: normalizedForm?.welcomeMessage || data.welcomeMessage || '',
          endingTitle: normalizedForm?.endingTitle || data.endingTitle || '',
          endingMessage: normalizedForm?.endingMessage || data.endingMessage || '',
          theme: data.theme || 'default',
          backgroundColor: data.backgroundColor || '#FFFFFF',
          textColor: data.textColor || '#333333',
          buttonColor: data.buttonColor || '#1A1A1A',
          buttonTextColor: data.buttonTextColor || '#FFFFFF',
          fontFamily: data.fontFamily || 'sans',
          progressbar: data.progressbar ?? true,
          showQuestionNumbers: data.showQuestionNumbers ?? true,
          allowBackNavigation: data.allowBackNavigation ?? true,
        }),
      });

      if (!formRes.ok) {
        setImportError('Failed to create form. Please try again.');
        setIsImporting(false);
        return;
      }

      const createdForm = await formRes.json();

      // Catalog Intake V2 uses the normalized section, visibility, multi-select,
      // Other-follow-up, and asset-link questions. Generic JSON still imports.
      const genericQuestions = data.questions as Record<string, unknown>[];
      const questionsPayload = normalizedQuestions || genericQuestions.map((q, index) => ({
        id: typeof q.id === 'string' && q.id ? q.id : `temp_import_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
        type: q.type,
        title: q.title,
        description: q.description || '',
        required: q.required || false,
        order: index,
        options: Array.isArray(q.options)
          ? q.options.map((opt: unknown, optIdx: number) => {
              if (typeof opt === 'string') return { id: `opt_${Date.now()}_${optIdx}`, label: opt };
              const optObj = opt as Record<string, unknown>;
              return { id: (optObj.id as string) || `opt_${Date.now()}_${optIdx}`, label: optObj.label as string };
            })
          : [],
        imageUrls: [],
        settings: (q.settings as Record<string, unknown>) || {},
        logic: [],
        placeholder: (q.placeholder as string) || '',
      }));

      if (questionsPayload.length > 0) {
        const questionsRes = await fetch(`/api/forms/${createdForm.id}/questions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: questionsPayload }),
        });
        if (!questionsRes.ok) {
          throw new Error('Failed to import questions');
        }
      }

      addForm(createdForm);
      setShowImportDialog(false);
      setImportJsonText('');
      setImportError('');
      toast({
        title: catalogImport ? 'Catalog intake imported' : 'Form imported',
        description: catalogImport?.warnings.length
          ? `"${createdForm.title}" is ready. Review the asset-link contact placeholders before publishing.`
          : `"${createdForm.title}" has been imported successfully.`,
      });
    } catch {
      setImportError('Network error. Could not import the form.');
    } finally {
      setIsImporting(false);
    }
  }, [importJsonText, addForm]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setImportError('Please upload a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
      setImportError('');
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-uploaded
    e.target.value = '';
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // N - Create new form
      if (e.key === 'n' && !isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleOpenNewFormDialog();
        return;
      }

      // / - Focus search
      if (e.key === '/' && !isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // G then G - Toggle view
      if (e.key === 'g' && !isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (gKeyBufferRef.current) {
          // Second G pressed
          e.preventDefault();
          gKeyBufferRef.current = false;
          if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current);
          setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
        } else {
          // First G pressed
          gKeyBufferRef.current = true;
          if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current);
          gKeyTimerRef.current = setTimeout(() => {
            gKeyBufferRef.current = false;
          }, 500);
        }
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
  }, [handleOpenNewFormDialog]);

  // ── Sidebar navigation items ──
  const navItems = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'templates', label: 'Templates', Icon: Layers },
    { key: 'themes', label: 'Themes', Icon: Palette },
    { key: 'resources', label: 'Resources', Icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Left Sidebar ── */}
      <aside
        className={`fixed lg:relative z-50 lg:z-auto h-screen flex flex-col bg-card border-r transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'w-[240px]' : 'w-[64px]'
        } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo / Brand */}
        <div className={`flex items-center h-16 border-b shrink-0 ${sidebarExpanded ? 'px-4' : 'px-0 justify-center'}`}>
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            {sidebarExpanded && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-bold tracking-tight"
              >
                Forms
              </motion.span>
            )}
          </div>
          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`ml-auto size-11 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden lg:flex ${!sidebarExpanded ? 'lg:hidden' : ''}`}
          >
            <ChevronLeft className={`size-4 transition-transform ${!sidebarExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expand toggle when collapsed (desktop) */}
        {!sidebarExpanded && (
          <button
            onClick={() => setSidebarExpanded(true)}
            className="hidden lg:flex size-11 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="size-4 rotate-180" />
          </button>
        )}

        {/* Navigation */}
        <nav className="py-2 px-2 space-y-1">
          {navItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => {
                setActiveNav(key);
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all relative ${
                sidebarExpanded ? 'min-h-11 px-3 py-2' : 'min-h-11 px-0 py-2 justify-center'
              } ${
                activeNav === key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {/* Active left border indicator */}
              {activeNav === key && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon className="size-[18px] shrink-0" />
              {sidebarExpanded && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Workspaces Section */}
        <div className="flex-1 border-t pt-2 pb-1 px-2 min-h-0 overflow-y-auto">
          <div className={`flex items-center justify-between mb-1 ${sidebarExpanded ? 'px-1' : 'justify-center'}`}>
            {sidebarExpanded && (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workspaces</span>
            )}
            <button
              onClick={() => {
                setNewWorkspaceName('');
                setNewWorkspaceColor('#2563EB');
                setShowCreateWorkspaceDialog(true);
              }}
              className="size-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Create workspace"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          {/* All Forms (no workspace filter) */}
          <button
            onClick={() => setActiveWorkspaceId(null)}
            className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-all ${
              sidebarExpanded ? 'min-h-11 px-3 py-2' : 'min-h-11 px-0 py-2 justify-center'
            } ${
              !activeWorkspaceId
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <FolderOpen className="size-4 shrink-0" />
            {sidebarExpanded && (
              <>
                <span className="flex-1 text-left truncate">All Forms</span>
                <span className="text-xs text-muted-foreground">{forms.filter(f => !f.archived).length}</span>
              </>
            )}
          </button>
          {/* Workspace items */}
          {workspaces.map((ws) => (
            <div key={ws.id} className="relative group">
              <button
                onClick={() => setActiveWorkspaceId(activeWorkspaceId === ws.id ? null : ws.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-all ${
                  sidebarExpanded ? 'min-h-11 px-3 py-2 pr-12' : 'min-h-11 px-0 py-2 justify-center'
                } ${
                  activeWorkspaceId === ws.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div
                  className="size-4 rounded shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: ws.color + '20', color: ws.color }}
                >
                  <Folder className="size-3" />
                </div>
                {sidebarExpanded && (
                  <>
                    <span className="flex-1 text-left truncate">{ws.name}</span>
                    <span className="text-xs text-muted-foreground">{getWorkspaceFormCount(ws.id)}</span>
                  </>
                )}
              </button>
              {/* Workspace actions (hover) */}
              {sidebarExpanded && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setWorkspaceMenuId(workspaceMenuId === ws.id ? null : ws.id); }}
                    className="size-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </div>
              )}
              {/* Workspace context menu */}
              {workspaceMenuId === ws.id && sidebarExpanded && (
                <div className="absolute left-0 right-0 top-full z-10 bg-popover border rounded-lg shadow-[var(--shadow-2)] py-1 mx-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id); setWorkspaceMenuId(null); }}
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="size-3" />
                    Delete Workspace
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className={`border-t p-2 space-y-1 shrink-0 ${!sidebarExpanded ? 'flex flex-col items-center' : ''}`}>
          {/* Dark mode toggle */}
          {mounted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all ${
                    sidebarExpanded ? 'min-h-11 px-3 py-2 w-full' : 'size-11 justify-center'
                  }`}
                >
                  <Sun className="size-[18px] shrink-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute size-[18px] shrink-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  {sidebarExpanded && <span>Theme</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={sidebarExpanded ? 'start' : 'end'} side="right">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="size-4 mr-2" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="size-4 mr-2" />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="size-4 mr-2" />
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User avatar placeholder */}
          <div className={`flex items-center gap-3 rounded-lg ${
            sidebarExpanded ? 'min-h-11 px-3 py-2' : 'min-h-11 px-0 py-2 justify-center'
          }`}>
            <div className="size-8 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary-foreground">{avatarInitial}</span>
            </div>
            {sidebarExpanded && (
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">Personal workspace</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with mobile menu + actions */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden size-11"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu className="size-5" />
              </Button>

              {/* Mobile logo */}
              <div className="flex items-center gap-2.5 lg:hidden">
                <BrandMark className="size-8" />
                <span className="text-base font-bold tracking-tight">Forms</span>
              </div>

              {/* Spacer */}
              <div className="flex-1 lg:hidden" />

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <NotificationBell />

                <Button
                  variant="outline"
                  onClick={() => {
                    setImportJsonText('');
                    setImportError('');
                    setShowImportDialog(true);
                  }}
                  size="sm"
                  className="min-h-11 gap-1.5"
                >
                  <Upload className="size-3.5" />
                  <span className="hidden sm:inline">Import</span>
                </Button>

                <Button
                  onClick={handleOpenNewFormDialog}
                  size="sm"
                  className="min-h-11 gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">New Form</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeNav === 'templates' ? (
          <DashboardTemplates onSelectTemplate={handleStartFromTemplate} />
        ) : activeNav === 'themes' ? (
          <DashboardAppearance theme={theme} onThemeChange={setTheme} />
        ) : activeNav === 'resources' ? (
          <DashboardResources onOpenShortcuts={() => setShowKeyboardShortcuts(true)} />
        ) : (
          <>
        {/* Welcome Section */}
        {!isLoading && forms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{greeting}</h2>
                <p className="text-muted-foreground mt-1">
                  You have {totalForms} {totalForms === 1 ? 'form' : 'forms'} — {publishedForms} {publishedForms === 1 ? 'is' : 'are'} published and {totalResponses} {totalResponses === 1 ? 'response' : 'responses'} collected.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-xl border bg-card p-4 shadow-[var(--shadow-1)]"
              >
                <p className="text-sm font-medium text-muted-foreground">Total forms</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{animatedTotalForms}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-success/20 bg-success/10 p-4"
              >
                <p className="text-sm font-medium text-success">Published</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{animatedPublishedForms}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-info/20 bg-info/10 p-4"
              >
                <p className="text-sm font-medium text-info">Responses</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{animatedTotalResponses}</p>
              </motion.div>
            </div>

            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div className="mt-5">
                <button
                  onClick={() => setShowActivity(!showActivity)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showActivity ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  Recent Activity
                </button>
                <AnimatePresence>
                  {showActivity && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 space-y-1">
                        {recentActivity.map((activity, idx) => (
                          <motion.div
                            key={activity.formId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-3 py-2 px-3 rounded-lg border-l-2 border-primary/20 hover:bg-muted/50 transition-colors group"
                          >
                            <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <activity.Icon className="size-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                <button
                                  onClick={() => openBuilder(activity.formId)}
                                  className="font-medium hover:text-primary transition-colors"
                                >
                                  {activity.formTitle}
                                </button>
                                <span className="text-muted-foreground"> {activity.activityLabel}</span>
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {activity.timeAgoText}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* Filter chips */}
        {!isLoading && forms.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {([
              { key: 'all' as FilterOption, label: 'All', Icon: null, count: filterCounts.all },
              { key: 'favorites' as FilterOption, label: 'Favorites', Icon: Heart, count: filterCounts.favorites },
              { key: 'archived' as FilterOption, label: 'Archived', Icon: Archive, count: filterCounts.archived },
            ]).map(({ key, label, Icon, count }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeFilter === key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {Icon && <Icon className="size-3.5" />}
                {label}
                <span className={`px-1.5 text-xs rounded-full ${
                  activeFilter === key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Toolbar: Search, Sort, View toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search forms... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SortAsc className="size-3.5" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger size="sm" className="min-h-10 gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted/50 focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sortLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-5 w-px bg-border" />

            {/* View toggle */}
            <div className="flex items-center border rounded-md p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-11"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-11"
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <List className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'flex flex-col gap-2'
            }
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden py-0 gap-0">
                <Skeleton className="h-2 w-full" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && forms.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-20 px-4"
          >
            <div className="mb-8 rounded-2xl border bg-primary/5 p-6 shadow-[var(--shadow-1)]">
              <Sparkles className="size-10 text-primary" />
            </div>

            <h2 className="text-2xl font-bold text-center mb-2">
              Create your first form
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Build beautiful, engaging forms that people love to fill out.
              Start from scratch or choose a template to get going quickly.
            </p>

            <Button
              size="lg"
              className="gap-2 text-base px-8"
              onClick={handleOpenNewFormDialog}
            >
              <Plus className="size-5" />
              Create a Form
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {/* No search results */}
        {!isLoading && forms.length > 0 && filteredForms.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <Search className="size-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {activeFilter === 'favorites'
                ? 'No favorite forms'
                : activeFilter === 'archived'
                ? 'No archived forms'
                : 'No forms found'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {activeFilter === 'favorites'
                ? 'Mark forms as favorites to see them here.'
                : activeFilter === 'archived'
                ? 'Archived forms will appear here.'
                : searchQuery
                ? `No forms match "${searchQuery}". Try a different search term.`
                : 'No forms to display.'}
            </p>
          </motion.div>
        )}

        {/* Form grid / list */}
        {!isLoading && filteredForms.length > 0 && (
          <AnimatePresence mode="popLayout">
            <motion.div
              variants={cardContainerVariants}
              initial="hidden"
              animate="visible"
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'flex flex-col gap-2'
              }
            >
              {filteredForms.map((form, index) => (
                <motion.div key={form.id} variants={cardItemVariants}>
                  <FormCard
                    form={form}
                    index={index}
                    viewMode={viewMode}
                    onEdit={openBuilder}
                    onPreview={openFiller}
                    onViewResponses={openResponses}
                    onDelete={handleDeleteForm}
                    onTitleUpdate={handleTitleUpdate}
                    onPublish={(formId, published) => updateForm(formId, { published })}
                    onDuplicate={(duplicatedForm) => addForm(duplicatedForm)}
                    onFavorite={(formId, favorite) => updateForm(formId, { favorite })}
                    onArchive={(formId, archived) => updateForm(formId, { archived })}
                    onAddTag={(formId, tags) => updateForm(formId, { tags })}
                    onMoveToWorkspace={handleMoveToWorkspace}
                    workspaces={workspaces}
                    timeAgoText={timeAgo(form.updatedAt || form.createdAt)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Forms &mdash; Create beautiful, interactive forms
          </p>
        </div>
      </footer>
      </div>{/* end main content area */}

      {/* Import Form Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        if (!open) {
          setShowImportDialog(false);
          setImportJsonText('');
          setImportError('');
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="size-4 text-primary" />
              </div>
              Import Form from JSON
            </DialogTitle>
            <DialogDescription>
              Paste JSON text or upload a .json file to import a form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* File upload */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="json-file-upload"
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              >
                <Upload className="size-4" />
                Upload .json file
                <input
                  id="json-file-upload"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <span className="text-xs text-muted-foreground">or paste below</span>
            </div>

            {/* JSON textarea */}
            <Textarea
              placeholder='Paste JSON here...'
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                setImportError('');
              }}
              rows={8}
              className="font-mono text-xs"
            />

            {/* Error message */}
            {importError && (
              <p className="text-sm text-destructive">{importError}</p>
            )}
            {importWarnings.length > 0 && (
              <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">Import notes</p>
                <ul className="list-disc space-y-1 pl-4">
                  {importWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportJsonText('');
                setImportError('');
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportForm}
              disabled={isImporting || !importJsonText.trim()}
            >
              {isImporting ? (
                <>
                  <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Form'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Theme controls opened from the live sidebar item */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Appearance</DialogTitle>
            <DialogDescription>Choose how the creator workspace looks on this device.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-2">
            {([
              { value: 'light', label: 'Light', Icon: Sun },
              { value: 'dark', label: 'Dark', Icon: Moon },
              { value: 'system', label: 'System', Icon: Monitor },
            ] as const).map(({ value, label, Icon }) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'outline'}
                className="h-auto flex-col gap-2 py-4"
                onClick={() => { setTheme(value); setShowThemeDialog(false); }}
              >
                <Icon className="size-5" />
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Resources are actionable help, not a dead navigation shell. */}
      <Dialog open={showResourcesDialog} onOpenChange={setShowResourcesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resources</DialogTitle>
            <DialogDescription>Quick help for building and testing a form.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { setShowResourcesDialog(false); setShowKeyboardShortcuts(true); }}>
              <Keyboard className="size-4" /> Keyboard shortcuts
            </Button>
            <a
              href="https://github.com/muhummadzarrar09-sudo/forms"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <BookOpen className="size-4" /> Project documentation &amp; source
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcuts
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
        context="dashboard"
      />

      {/* Create Workspace Dialog */}
      <Dialog open={showCreateWorkspaceDialog} onOpenChange={setShowCreateWorkspaceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Folder className="size-4 text-primary" />
              </div>
              Create Workspace
            </DialogTitle>
            <DialogDescription>
              Organize your forms into folders for easy access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g., Marketing, HR, Client Forms"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newWorkspaceName.trim()) {
                    handleCreateWorkspace();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex items-center gap-2">
                {['#2563EB', '#6D28D9', '#0F766E', '#B45309', '#BE123C'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewWorkspaceColor(color)}
                    className={`size-11 rounded-full transition-all ${
                      newWorkspaceColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWorkspaceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim() || isCreatingWorkspace}>
              {isCreatingWorkspace ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Form Dialog - Template Picker */}
      <Dialog open={showNewFormDialog} onOpenChange={(open) => {
        if (!open) {
          setShowNewFormDialog(false);
          setSelectedTemplateId(null);
          setNewFormTitle('');
          setNewFormDescription('');
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                {dialogStep === 'template' ? (
                  <Sparkles className="size-4 text-primary" />
                ) : (
                  <Plus className="size-4 text-primary" />
                )}
              </div>
              {dialogStep === 'template' ? 'Choose a Template' : 'Name Your Form'}
            </DialogTitle>
            <DialogDescription>
              {dialogStep === 'template'
                ? 'Start from scratch or pick a template to get going quickly.'
                : 'Give your form a name and optional description. You can edit these later.'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {dialogStep === 'template' ? (
              <motion.div
                key="template-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-y-auto -mx-6 px-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                  {/* Start from Scratch card */}
                  <TemplateCard
                    template={{
                      id: 'blank',
                      title: 'Start from Scratch',
                      description: 'Create a blank form and add your own questions.',
                      icon: 'FileText',
                      questions: [],
                    }}
                    isSelected={selectedTemplateId === null}
                    onClick={() => handleSelectTemplate(null)}
                    isBlank
                  />

                  {/* Template cards */}
                  {FORM_TEMPLATES.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplateId === template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="details-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 py-2"
              >
                {/* Selected template indicator */}
                {selectedTemplateId && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                    {(() => {
                      const template = FORM_TEMPLATES.find((t) => t.id === selectedTemplateId);
                      if (!template) return null;
                      const IconComp = ICON_MAP[template.icon] || FileText;
                      const accent = templateAccent(template);
                      return (
                        <>
                          <div
                            className="size-8 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${accent}20` }}
                          >
                            <IconComp className="size-4" style={{ color: accent }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{template.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {template.questions.length} question{template.questions.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Check className="size-4 text-primary shrink-0" />
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Form title */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Form title</label>
                  <Input
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    placeholder="Enter a title for your form"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFormTitle.trim()) {
                        handleCreateForm();
                      }
                    }}
                  />
                </div>

                {/* Form description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Textarea
                    value={newFormDescription}
                    onChange={(e) => setNewFormDescription(e.target.value)}
                    placeholder="What is this form about?"
                    rows={2}
                  />
                </div>

                {/* Workspace selector */}
                {workspaces.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Workspace (optional)</label>
                    <Select value={newFormWorkspaceId || '__none__'} onValueChange={(v) => setNewFormWorkspaceId(v === '__none__' ? null : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No workspace</SelectItem>
                        {workspaces.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>
                            <div className="flex items-center gap-2">
                              <div className="size-2.5 rounded-full" style={{ backgroundColor: ws.color }} />
                              {ws.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="gap-2 sm:gap-0">
            {dialogStep === 'details' && (
              <Button
                variant="outline"
                onClick={() => setDialogStep('template')}
                disabled={isCreating}
              >
                <ArrowLeft className="size-4 mr-1" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => {
                setShowNewFormDialog(false);
                setSelectedTemplateId(null);
                setNewFormTitle('');
                setNewFormDescription('');
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            {dialogStep === 'details' && (
              <Button
                onClick={handleCreateForm}
                disabled={isCreating || !newFormTitle.trim()}
              >
                {isCreating ? (
                  <>
                    <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Form
                    <ArrowRight className="size-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Template Card ──

function TemplateCard({
  template,
  isSelected,
  onClick,
  isBlank = false,
}: {
  template: FormTemplate;
  isSelected: boolean;
  onClick: () => void;
  isBlank?: boolean;
}) {
  const IconComp = ICON_MAP[template.icon] || FileText;
  const accent = isBlank ? '#64748B' : templateAccent(template);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-[var(--shadow-1)] ring-1 ring-primary/20'
          : 'border-border hover:border-border/80 hover:shadow-[var(--shadow-1)]'
      }`}
    >
      {/* Color accent bar */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: accent }}
      />

      {/* Icon */}
      <div
        className="size-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          backgroundColor: isBlank ? 'var(--muted)' : `${accent}18`,
        }}
      >
        <IconComp
          className="size-4"
          style={{ color: isBlank ? 'var(--muted-foreground)' : accent }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{template.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
          {template.description}
        </p>
        {!isBlank && template.questions.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {template.questions.length} questions
          </p>
        )}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="size-4 text-primary" />
        </div>
      )}
    </motion.button>
  );
}

function DashboardTemplates({ onSelectTemplate }: { onSelectTemplate: (templateId: string) => void }) {
  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Start with momentum</p>
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">Choose a proven structure, then make it yours. Every template remains fully editable.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FORM_TEMPLATES.map((template) => {
          const Icon = ICON_MAP[template.icon] || FileText;
          const accent = templateAccent(template);
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className="group rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-2)]"
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}18`, color: accent }}>
                  <Icon className="size-5" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h2 className="font-semibold">{template.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{template.questions.length} questions · Use template</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DashboardAppearance({ theme, onThemeChange }: { theme?: string; onThemeChange: (theme: string) => void }) {
  const options = [
    { value: 'light', title: 'Light', description: 'Clean and editorial for bright workspaces.', Icon: Sun },
    { value: 'dark', title: 'Dark', description: 'Focused low-light workspace with strong contrast.', Icon: Moon },
    { value: 'system', title: 'System', description: 'Follow your operating system preference.', Icon: Monitor },
  ];
  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your workspace</p>
        <h1 className="text-3xl font-bold tracking-tight">Appearance</h1>
        <p className="text-muted-foreground">Choose a comfortable creator environment. Form themes stay independent inside each form.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {options.map(({ value, title, description, Icon }) => (
          <button
            key={value}
            onClick={() => onThemeChange(value)}
            className={`rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)] ${theme === value ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card hover:border-primary/40'}`}
          >
            <Icon className="mb-8 size-6 text-primary" />
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {theme === value && <p className="mt-4 text-xs font-semibold text-primary">Selected</p>}
          </button>
        ))}
      </div>
    </section>
  );
}

function DashboardResources({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Learn by doing</p>
        <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
        <p className="text-muted-foreground">Useful shortcuts and project documentation without sending you through a dead navigation item.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <button onClick={onOpenShortcuts} className="rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-2)]">
          <Keyboard className="mb-6 size-6 text-primary" />
          <h2 className="font-semibold">Keyboard shortcuts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Navigate faster across dashboard and builder workflows.</p>
        </button>
        <a href="https://github.com/muhummadzarrar09-sudo/forms" target="_blank" rel="noreferrer" className="rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-2)]">
          <BookOpen className="mb-6 size-6 text-primary" />
          <h2 className="font-semibold">Project documentation</h2>
          <p className="mt-1 text-sm text-muted-foreground">Read deployment, testing, and developer notes.</p>
        </a>
      </div>
    </section>
  );
}
