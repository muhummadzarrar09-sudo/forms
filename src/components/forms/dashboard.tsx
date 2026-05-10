'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormStore } from '@/store/form-store';
import type { Form } from '@/types/form';
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
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { FormCard } from '@/components/forms/form-card';
import { FORM_TEMPLATES, type FormTemplate } from '@/lib/form-helpers';

type SortOption = 'newest' | 'oldest' | 'title' | 'responses';

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
  } = useFormStore();

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showNewFormDialog, setShowNewFormDialog] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDescription, setNewFormDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Template picker state
  const [dialogStep, setDialogStep] = useState<'template' | 'details'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Fetch forms on mount
  useEffect(() => {
    const fetchForms = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/forms');
        if (res.ok) {
          const data = await res.json();
          setForms(data);
        } else {
          toast({
            title: 'Error loading forms',
            description: 'Could not fetch your forms. Please try again.',
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
        setIsLoading(false);
      }
    };
    fetchForms();
  }, [setForms, setIsLoading]);

  // Filter and sort forms
  const filteredForms = useMemo(() => {
    let result = [...forms];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query)
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
  }, [forms, searchQuery, sortBy]);

  // Stats
  const totalForms = forms.length;
  const publishedForms = forms.filter((f) => f.published).length;
  const totalResponses = forms.reduce(
    (acc, f) => acc + (f._count?.responses ?? 0),
    0
  );

  // Reset dialog state when opening
  const handleOpenNewFormDialog = useCallback(() => {
    setDialogStep('template');
    setSelectedTemplateId(null);
    setNewFormTitle('');
    setNewFormDescription('');
    setShowNewFormDialog(true);
  }, []);

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
          method: 'PATCH',
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Brand */}
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="size-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">Forms</span>
            </div>

            {/* New Form button */}
            <div className="flex items-center gap-2">
              {/* Dark mode toggle */}
              {mounted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      <span className="sr-only">Toggle theme</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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

              <Button
                onClick={handleOpenNewFormDialog}
                size="default"
                className="gap-2"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">New Form</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-6 flex-1">
            <div>
              <p className="text-2xl font-bold">{totalForms}</p>
              <p className="text-xs text-muted-foreground">
                {totalForms === 1 ? 'Form' : 'Forms'}
              </p>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            <div className="hidden sm:block">
              <p className="text-2xl font-bold">{publishedForms}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            <div className="hidden sm:block">
              <p className="text-2xl font-bold">{totalResponses}</p>
              <p className="text-xs text-muted-foreground">
                {totalResponses === 1 ? 'Response' : 'Responses'}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Sort, View toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SortAsc className="size-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent border-none text-xs text-muted-foreground cursor-pointer focus:outline-none pr-1"
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-5 w-px bg-border" />

            {/* View toggle */}
            <div className="flex items-center border rounded-md p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
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
            <div className="relative mb-8">
              {/* Decorative background circles */}
              <div className="absolute -inset-6 rounded-full bg-primary/5 animate-pulse" />
              <div className="absolute -inset-3 rounded-full bg-primary/10" />
              <div className="relative size-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Sparkles className="size-10 text-primary/70" />
              </div>
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
            <h3 className="text-lg font-medium mb-1">No forms found</h3>
            <p className="text-muted-foreground text-sm">
              No forms match &ldquo;{searchQuery}&rdquo;. Try a different search term.
            </p>
          </motion.div>
        )}

        {/* Form grid / list */}
        {!isLoading && filteredForms.length > 0 && (
          <AnimatePresence mode="popLayout">
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'flex flex-col gap-2'
              }
            >
              {filteredForms.map((form, index) => (
                <FormCard
                  key={form.id}
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
                />
              ))}
            </div>
          </AnimatePresence>
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
                      color: '#6B7280',
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
                      return (
                        <>
                          <div
                            className="size-8 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${template.color}20` }}
                          >
                            <IconComp className="size-4" style={{ color: template.color }} />
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

                <div className="space-y-2">
                  <label
                    htmlFor="form-title"
                    className="text-sm font-medium leading-none"
                  >
                    Title <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="form-title"
                    placeholder="e.g., Customer Feedback Survey"
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isCreating && newFormTitle.trim()) {
                        handleCreateForm();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="form-description"
                    className="text-sm font-medium leading-none"
                  >
                    Description{' '}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <Textarea
                    id="form-description"
                    placeholder="What is this form about?"
                    value={newFormDescription}
                    onChange={(e) => setNewFormDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="gap-2 sm:gap-0">
            {dialogStep === 'template' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewFormDialog(false);
                    setSelectedTemplateId(null);
                    setNewFormTitle('');
                    setNewFormDescription('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSelectTemplate(null)}
                >
                  Start from Scratch
                  <ArrowRight className="size-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogStep('template');
                  }}
                  disabled={isCreating}
                >
                  <ArrowLeft className="size-4 mr-1" />
                  Back
                </Button>
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
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template card component
function TemplateCard({
  template,
  isSelected,
  onClick,
  isBlank,
}: {
  template: FormTemplate;
  isSelected: boolean;
  onClick: () => void;
  isBlank?: boolean;
}) {
  const IconComp = ICON_MAP[template.icon] || FileText;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Card
        className={`cursor-pointer transition-all duration-200 py-0 gap-0 overflow-hidden ${
          isSelected
            ? 'ring-2 ring-primary shadow-md'
            : 'hover:shadow-md hover:border-muted-foreground/30'
        }`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={`Select ${template.title} template`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Color accent bar */}
        {!isBlank && (
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: template.color }}
          />
        )}
        {isBlank && (
          <div className="h-1.5 w-full bg-muted" />
        )}
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="size-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: isBlank ? 'hsl(var(--muted))' : `${template.color}15`,
              }}
            >
              <IconComp
                className="size-5"
                style={{ color: isBlank ? 'hsl(var(--muted-foreground))' : template.color }}
              />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold leading-tight mb-1 truncate">
                {template.title}
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {template.description}
              </p>
              {!isBlank && template.questions.length > 0 && (
                <Badge variant="secondary" className="mt-2 text-[10px] px-1.5 py-0 h-5">
                  {template.questions.length} question{template.questions.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
