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
  Plus,
  FileText,
  LayoutGrid,
  List,
  Search,
  SortAsc,
  Sparkles,
  ArrowRight,
  Users,
  FormsIcon,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { FormCard } from '@/components/forms/form-card';

type SortOption = 'newest' | 'oldest' | 'title' | 'responses';

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

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showNewFormDialog, setShowNewFormDialog] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDescription, setNewFormDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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

  // Create new form
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
        setShowNewFormDialog(false);
        setNewFormTitle('');
        setNewFormDescription('');
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
  }, [newFormTitle, newFormDescription, addForm, openBuilder]);

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
            <Button
              onClick={() => setShowNewFormDialog(true)}
              size="default"
              className="gap-2"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Form</span>
            </Button>
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
              Start from scratch and watch the responses roll in.
            </p>

            <Button
              size="lg"
              className="gap-2 text-base px-8"
              onClick={() => setShowNewFormDialog(true)}
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

      {/* New Form Dialog */}
      <Dialog open={showNewFormDialog} onOpenChange={setShowNewFormDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="size-4 text-primary" />
              </div>
              Create New Form
            </DialogTitle>
            <DialogDescription>
              Give your form a name and optional description to get started.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
                  if (e.key === 'Enter' && !isCreating) {
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewFormDialog(false);
                setNewFormTitle('');
                setNewFormDescription('');
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateForm} disabled={isCreating || !newFormTitle.trim()}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
