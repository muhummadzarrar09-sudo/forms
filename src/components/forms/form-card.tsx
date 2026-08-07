'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Form, Workspace } from '@/types/form';
import { ShareDialog } from '@/components/forms/share-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Pencil,
  Eye,
  BarChart3,
  Trash2,
  MoreVertical,
  Calendar,
  Users,
  GripVertical,
  Share2,
  Copy,
  BarChart2,
  Download,
  Heart,
  Archive,
  ArchiveRestore,
  Tag,
  X,
  Plus,
  Folder,
  FolderInput,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { deriveFormTheme } from '@/lib/form-theme';

// Tags are metadata, not status. Keeping them neutral avoids assigning a
// misleading semantic meaning or unreadable color to an arbitrary word.
const TAG_CLASS = 'border border-border bg-secondary text-secondary-foreground';

interface FormCardProps {
  form: Form;
  onEdit: (formId: string) => void;
  onPreview: (formId: string) => void;
  onViewResponses: (formId: string) => void;
  onDelete: (formId: string) => void;
  onTitleUpdate: (formId: string, title: string) => void;
  onPublish?: (formId: string, published: boolean) => void;
  onDuplicate?: (form: Form) => void;
  onFavorite?: (formId: string, favorite: boolean) => void;
  onArchive?: (formId: string, archived: boolean) => void;
  onAddTag?: (formId: string, tags: string[]) => void;
  onMoveToWorkspace?: (formId: string, workspaceId: string | null) => void;
  workspaces?: Workspace[];
  index: number;
  viewMode: 'grid' | 'list';
  timeAgoText?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function FormCard({
  form,
  onEdit,
  onPreview,
  onViewResponses,
  onDelete,
  onTitleUpdate,
  onPublish,
  onDuplicate,
  onFavorite,
  onArchive,
  onAddTag,
  onMoveToWorkspace,
  workspaces,
  index,
  viewMode,
  timeAgoText,
}: FormCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(form.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagPopover, setShowTagPopover] = useState(false);

  const formTheme = deriveFormTheme(form);
  const themeColor = formTheme.buttonColor;
  const responseCount = form._count?.responses ?? 0;
  const formTags = form.tags || [];
  const formWorkspace = form.workspace;

  // Workspace indicator component
  const renderWorkspaceIndicator = () => {
    if (!formWorkspace) return null;
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div
          className="size-2.5 rounded-full shrink-0 border"
          style={{ backgroundColor: formWorkspace.color, borderColor: formTheme.fieldBorderColor }}
        />
        <span className="truncate max-w-[100px]">{formWorkspace.name}</span>
      </div>
    );
  };

  const handleTitleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== form.title) {
      onTitleUpdate(form.id, trimmed);
      toast({
        title: 'Title updated',
        description: `Form title changed to "${trimmed}"`,
      });
    } else {
      setEditTitle(form.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(form.title);
      setIsEditingTitle(false);
    }
  };

  const handleDelete = () => {
    onDelete(form.id);
    setShowDeleteDialog(false);
    toast({
      title: 'Form deleted',
      description: `"${form.title}" has been permanently deleted.`,
      variant: 'destructive',
    });
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/duplicate`, {
        method: 'POST',
      });
      if (res.ok) {
        const duplicatedForm = await res.json();
        onDuplicate?.(duplicatedForm);
        toast({
          title: 'Form duplicated',
          description: `"Copy of ${form.title}" has been created as a draft.`,
        });
      } else {
        toast({
          title: 'Failed to duplicate',
          description: 'Could not duplicate the form. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Failed to duplicate',
        description: 'Could not duplicate the form. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleExportJSON = () => {
    const exportData = {
      version: 1,
      title: form.title,
      description: form.description,
      welcomeTitle: form.welcomeTitle || '',
      welcomeMessage: form.welcomeMessage || '',
      endingTitle: form.endingTitle || '',
      endingMessage: form.endingMessage || '',
      theme: form.theme || 'default',
      backgroundColor: form.backgroundColor,
      textColor: form.textColor,
      buttonColor: form.buttonColor,
      buttonTextColor: form.buttonTextColor,
      fontFamily: form.fontFamily || 'sans',
      progressbar: form.progressbar ?? true,
      showQuestionNumbers: form.showQuestionNumbers ?? true,
      allowBackNavigation: form.allowBackNavigation ?? true,
      questions: (form.questions || []).map((q) => ({
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
    a.download = `${form.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Form exported',
      description: `"${form.title}" has been exported as JSON.`,
    });
  };

  const handlePublish = async () => {
    const newPublished = !form.published;
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newPublished }),
      });
      if (res.ok) {
        onPublish?.(form.id, newPublished);
        toast({
          title: newPublished ? 'Form published' : 'Form unpublished',
          description: newPublished
            ? 'Your form is now live and accepting responses.'
            : 'Your form is now in draft mode.',
        });
      }
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleFavorite = async () => {
    const newFavorite = !form.favorite;
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: newFavorite }),
      });
      if (res.ok) {
        onFavorite?.(form.id, newFavorite);
        toast({
          title: newFavorite ? 'Added to favorites' : 'Removed from favorites',
          description: newFavorite
            ? `"${form.title}" is now a favorite.`
            : `"${form.title}" is no longer a favorite.`,
        });
      }
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    const newArchived = !form.archived;
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: newArchived }),
      });
      if (res.ok) {
        onArchive?.(form.id, newArchived);
        toast({
          title: newArchived ? 'Form archived' : 'Form unarchived',
          description: newArchived
            ? `"${form.title}" has been archived.`
            : `"${form.title}" has been unarchived.`,
        });
      }
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (formTags.includes(tag)) {
      toast({ title: 'Tag already exists', variant: 'destructive' });
      return;
    }
    const newTags = [...formTags, tag];
    onAddTag?.(form.id, newTags);
    fetch(`/api/forms/${form.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    }).catch(() => {
      toast({ title: 'Failed to add tag', variant: 'destructive' });
    });
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = formTags.filter((t) => t !== tagToRemove);
    onAddTag?.(form.id, newTags);
    fetch(`/api/forms/${form.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    }).catch(() => {
      toast({ title: 'Failed to remove tag', variant: 'destructive' });
    });
  };

  // Tag pills component (shared between list and grid)
  const renderTagPills = (maxVisible = 2) => {
    if (formTags.length === 0) return null;
    const visibleTags = formTags.slice(0, maxVisible);
    const remaining = formTags.length - maxVisible;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {visibleTags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-0.5 min-h-11 text-xs px-2 py-1 rounded-full font-medium ${TAG_CLASS}`}
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag);
              }}
              className="ml-0.5 flex size-11 items-center justify-center rounded-full hover:bg-foreground/10"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            +{remaining} more
          </span>
        )}
      </div>
    );
  };

  // Favorite heart button for grid view
  const renderFavoriteButton = (className = '') => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleFavorite();
      }}
      className={`flex size-11 items-center justify-center rounded-full transition-colors ${className} ${
        form.favorite
          ? 'text-rose-600 hover:bg-rose-500/10'
          : 'hover:opacity-70'
      }`}
      style={{ color: form.favorite ? undefined : formTheme.textColor }}
      aria-label={form.favorite ? 'Remove from favorites' : 'Add to favorites'}
      title={form.favorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart className={`size-4 ${form.favorite ? 'fill-current' : ''}`} />
    </button>
  );

  // Tag popover for adding tags
  const renderTagPopover = () => (
    <Popover open={showTagPopover} onOpenChange={setShowTagPopover}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-full"
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tag className="size-4 mr-2" />
            Add Tag
          </DropdownMenuItem>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add a tag</p>
          {/* Existing tags */}
          {formTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {formTags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-0.5 min-h-11 text-xs px-2 py-1 rounded-full font-medium ${TAG_CLASS}`}
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-70">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Tag name..."
              className="min-h-10 text-xs"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              size="sm"
              variant="outline"
              className="min-h-10 px-3 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleAddTag();
              }}
              disabled={!tagInput.trim()}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (viewMode === 'list') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
        >
          <Card className="group relative overflow-hidden border transition-all duration-200 hover:shadow-[var(--shadow-2)] hover:border-border/80 py-0 gap-0">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
                {/* Color indicator */}
                <div
                  className="hidden sm:block w-1 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: themeColor }}
                />

                {/* Drag handle */}
                <GripVertical className="size-4 text-muted-foreground/40 hidden sm:block shrink-0" />

                {renderFavoriteButton('shrink-0')}

                {/* Title & description */}
                <div className="flex-1 min-w-0">
                  {isEditingTitle ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={handleTitleKeyDown}
                      autoFocus
                      className="min-h-11 text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3
                      className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setIsEditingTitle(true)}
                      title="Click to edit title"
                    >
                      {form.title}
                    </h3>
                  )}
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {form.description || 'No description'}
                  </p>
                  {/* Tags */}
                  {formTags.length > 0 && (
                    <div className="mt-1">
                      {renderTagPills(2)}
                    </div>
                  )}
                  {formWorkspace && (
                    <div className="mt-1">
                      {renderWorkspaceIndicator()}
                    </div>
                  )}
                  {timeAgoText && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Edited {timeAgoText}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <Badge
                  variant={form.published ? 'default' : 'secondary'}
                  className={`shrink-0 min-h-8 px-2 text-xs ${form.published ? 'bg-success text-success-foreground hover:bg-success/90' : ''}`}
                >
                  {form.published ? 'Published' : 'Draft'}
                </Badge>

                {/* Response count */}
                <div className="hidden md:flex items-center gap-1 text-xs shrink-0">
                  <Badge variant="secondary" className="min-h-8 gap-1 px-2 text-xs font-normal">
                    <Users className="size-3" />
                    {responseCount}
                  </Badge>
                </div>

                {/* Date */}
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Calendar className="size-3.5" />
                  <span>{formatDate(form.createdAt)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-10 px-3 text-xs"
                    onClick={() => onEdit(form.id)}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-10 px-3 text-xs"
                    onClick={() => onPreview(form.id)}
                  >
                    <Eye className="size-3.5 mr-1" />
                    <span className="hidden sm:inline">Preview</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-11">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                        <Share2 className="size-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewResponses(form.id)}>
                        <BarChart3 className="size-4 mr-2" />
                        View Responses
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleFavorite}>
                        <Heart className={`size-4 mr-2 ${form.favorite ? 'fill-current text-rose-600' : ''}`} />
                        {form.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleArchive}>
                        {form.archived ? (
                          <>
                            <ArchiveRestore className="size-4 mr-2" />
                            Unarchive
                          </>
                        ) : (
                          <>
                            <Archive className="size-4 mr-2" />
                            Archive
                          </>
                        )}
                      </DropdownMenuItem>
                      {renderTagPopover()}
                      <DropdownMenuSeparator />
                      {/* Move to Workspace */}
                      {onMoveToWorkspace && workspaces && workspaces.length > 0 && (
                        <>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="p-0"
                          >
                            <div className="w-full px-2 py-1.5 text-sm flex items-center gap-2 cursor-default">
                              <FolderInput className="size-4" />
                              Move to...
                            </div>
                          </DropdownMenuItem>
                          <div className="pl-6">
                            <DropdownMenuItem
                              onClick={() => onMoveToWorkspace(form.id, null)}
                              className={!form.workspaceId ? 'text-primary' : ''}
                            >
                              <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
                              No Workspace
                            </DropdownMenuItem>
                            {workspaces.map((ws) => (
                              <DropdownMenuItem
                                key={ws.id}
                                onClick={() => onMoveToWorkspace(form.id, ws.id)}
                                className={form.workspaceId === ws.id ? 'text-primary' : ''}
                              >
                                <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                                {ws.name}
                              </DropdownMenuItem>
                            ))}
                          </div>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleDuplicate}
                        disabled={isDuplicating}
                      >
                        <Copy className="size-4 mr-2" />
                        {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportJSON}>
                        <Download className="size-4 mr-2" />
                        Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete Form
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{form.title}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the form
                and all of its {responseCount} response{responseCount !== 1 ? 's' : ''}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Grid view
  const questionCount = form.questions?.length ?? 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, delay: index * 0.05 }}
        whileHover={{ y: -2 }}
        className="h-full"
      >
        <Card className="group relative overflow-hidden border transition-all duration-300 hover:shadow-[var(--shadow-2)] hover:border-border/80 h-full flex flex-col py-0 gap-0">
          {/* Large colored area with gradient overlay for depth */}
          <div
            className="h-28 w-full shrink-0 relative flex flex-col justify-between p-3 overflow-hidden border-b-4"
            style={{
              backgroundColor: formTheme.backgroundColor,
              color: formTheme.textColor,
              borderColor: formTheme.buttonColor,
            }}
          >
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${formTheme.selectedSurfaceColor}, transparent 72%)` }}
            />
            {/* Favorite heart in top-left corner */}
            <div className="absolute top-2 left-2">
              {renderFavoriteButton(form.favorite ? '' : '')}
            </div>

            <div className="absolute left-14 top-4 flex items-center gap-1.5 text-xs font-medium" style={{ color: form.published ? 'var(--success)' : formTheme.textSecondaryColor }}>
              <span className={`size-2.5 rounded-full ${form.published ? 'bg-success' : 'bg-muted-foreground'}`} />
              {form.published ? 'Live' : 'Draft'}
            </div>

            {/* Title inside colored area */}
            <div className="relative z-10 flex-1 min-w-0 pt-8 pr-11">
              {isEditingTitle ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                  className="min-h-11 text-base font-bold"
                  style={{ color: formTheme.textColor, backgroundColor: formTheme.controlSurfaceColor, borderColor: formTheme.fieldBorderColor }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h3
                  className="line-clamp-2 cursor-pointer text-base font-bold leading-snug transition-opacity hover:opacity-80"
                  style={{ color: formTheme.textColor }}
                  onClick={() => onEdit(form.id)}
                  title="Open in builder"
                >
                  {form.title}
                </h3>
              )}
            </div>

            {/* Question count badge */}
            <Badge
              variant="outline"
              className="min-h-8 self-start border px-2 text-xs"
              style={{ backgroundColor: formTheme.controlSurfaceColor, color: formTheme.textColor, borderColor: formTheme.fieldBorderColor }}
            >
              {questionCount} question{questionCount !== 1 ? 's' : ''}
            </Badge>

            {/* Dropdown menu trigger overlaid */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 shrink-0"
                  style={{ color: formTheme.textColor, backgroundColor: formTheme.controlSurfaceColor }}
                  aria-label={`Open actions for ${form.title}`}
                >
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(form.id)}>
                  <Pencil className="size-4 mr-2" />
                  Edit in Builder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPreview(form.id)}>
                  <Eye className="size-4 mr-2" />
                  Preview Form
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                  <Share2 className="size-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewResponses(form.id)}>
                  <BarChart3 className="size-4 mr-2" />
                  View Responses
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleFavorite}>
                  <Heart className={`size-4 mr-2 ${form.favorite ? 'fill-current text-rose-600' : ''}`} />
                  {form.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive}>
                  {form.archived ? (
                    <>
                      <ArchiveRestore className="size-4 mr-2" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="size-4 mr-2" />
                      Archive
                    </>
                  )}
                </DropdownMenuItem>
                {renderTagPopover()}
                <DropdownMenuSeparator />
                {/* Move to Workspace */}
                {onMoveToWorkspace && workspaces && workspaces.length > 0 && (
                  <>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="p-0"
                    >
                      <div className="w-full px-2 py-1.5 text-sm flex items-center gap-2 cursor-default">
                        <FolderInput className="size-4" />
                        Move to...
                      </div>
                    </DropdownMenuItem>
                    <div className="pl-6">
                      <DropdownMenuItem
                        onClick={() => onMoveToWorkspace(form.id, null)}
                        className={!form.workspaceId ? 'text-primary' : ''}
                      >
                        <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
                        No Workspace
                      </DropdownMenuItem>
                      {workspaces.map((ws) => (
                        <DropdownMenuItem
                          key={ws.id}
                          onClick={() => onMoveToWorkspace(form.id, ws.id)}
                          className={form.workspaceId === ws.id ? 'text-primary' : ''}
                        >
                          <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                          {ws.name}
                        </DropdownMenuItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                  <Pencil className="size-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                >
                  <Copy className="size-4 mr-2" />
                  {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON}>
                  <Download className="size-4 mr-2" />
                  Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete Form
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CardContent className="p-3.5 flex flex-col flex-1 gap-1.5">
            {/* Description */}
            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
              {form.description || 'No description'}
            </p>

            {/* Last edited subtitle */}
            {timeAgoText && (
              <p className="text-xs text-muted-foreground">
                Last edited {timeAgoText}
              </p>
            )}

            {/* Tags */}
            {formTags.length > 0 && renderTagPills(2)}

            {/* Workspace indicator */}
            {formWorkspace && renderWorkspaceIndicator()}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Footer row */}
            <div className="flex items-center justify-between pt-1.5 border-t">
              <div className="flex items-center gap-2">
                <Badge
                  variant={form.published ? 'default' : 'secondary'}
                  className={`min-h-8 px-2 text-xs ${form.published ? 'bg-success text-success-foreground hover:bg-success/90' : ''}`}
                >
                  {form.published ? 'Published' : 'Draft'}
                </Badge>
                {responseCount > 0 ? (
                  <Badge variant="outline" className="min-h-8 gap-1 px-2 text-xs">
                    <BarChart2 className="size-3" />
                    {responseCount}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">0 responses</span>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                {timeAgoText || formatDate(form.createdAt)}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 flex-1 gap-1 text-xs"
                onClick={() => onEdit(form.id)}
              >
                <Pencil className="size-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 flex-1 gap-1 text-xs"
                onClick={() => onPreview(form.id)}
              >
                <Eye className="size-3" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 px-3 text-xs"
                onClick={() => onViewResponses(form.id)}
              >
                <BarChart3 className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{form.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the form
              and all of its {responseCount} response{responseCount !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        form={form}
        onPublish={handlePublish}
      />
    </>
  );
}
