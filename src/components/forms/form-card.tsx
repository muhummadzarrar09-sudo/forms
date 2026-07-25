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

// Tag color system
const TAG_COLORS = [
  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

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

function getThemeColor(backgroundColor: string): string {
  if (!backgroundColor || backgroundColor === '#FFFFFF' || backgroundColor === '#ffffff') {
    return '#1A1A1A';
  }
  return backgroundColor;
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

  const themeColor = getThemeColor(form.backgroundColor);
  const responseCount = form._count?.responses ?? 0;
  const formTags = form.tags || [];
  const formWorkspace = form.workspace;

  // Workspace indicator component
  const renderWorkspaceIndicator = () => {
    if (!formWorkspace) return null;
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <div
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: formWorkspace.color }}
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
            className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTagColor(tag)}`}
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag);
              }}
              className="hover:opacity-70 ml-0.5"
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-[10px] text-muted-foreground font-medium">
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
      className={`transition-all ${className} ${
        form.favorite
          ? 'text-red-500 hover:text-red-600'
          : 'text-white/60 hover:text-red-400 opacity-0 group-hover:opacity-100'
      }`}
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
                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTagColor(tag)}`}
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-70">
                    <X className="size-2.5" />
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
              className="h-7 text-xs"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 shrink-0"
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
          <Card className="group relative overflow-hidden border transition-all duration-200 hover:shadow-md hover:border-border/80 py-0 gap-0">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
                {/* Color indicator */}
                <div
                  className="hidden sm:block w-1 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: themeColor }}
                />

                {/* Drag handle */}
                <GripVertical className="size-4 text-muted-foreground/40 hidden sm:block shrink-0" />

                {/* Favorite heart */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavorite();
                  }}
                  className={`shrink-0 transition-all ${
                    form.favorite
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-muted-foreground/30 hover:text-red-400'
                  }`}
                  title={form.favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`size-4 ${form.favorite ? 'fill-current' : ''}`} />
                </button>

                {/* Title & description */}
                <div className="flex-1 min-w-0">
                  {isEditingTitle ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={handleTitleKeyDown}
                      autoFocus
                      className="h-7 text-sm font-medium"
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
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Edited {timeAgoText}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <Badge
                  variant={form.published ? 'default' : 'secondary'}
                  className="shrink-0 text-[10px] px-2 py-0 h-5"
                >
                  {form.published ? 'Published' : 'Draft'}
                </Badge>

                {/* Response count */}
                <div className="hidden md:flex items-center gap-1 text-xs shrink-0">
                  <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 gap-1 font-normal">
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
                    className="h-7 px-2 text-xs"
                    onClick={() => onEdit(form.id)}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onPreview(form.id)}
                  >
                    <Eye className="size-3.5 mr-1" />
                    <span className="hidden sm:inline">Preview</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
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
                        <Heart className={`size-4 mr-2 ${form.favorite ? 'fill-current text-red-500' : ''}`} />
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
                className="bg-destructive text-white hover:bg-destructive/90"
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

  // Determine text color for readability on colored background
  const isLightColor = (hex: string): boolean => {
    if (!hex || hex === '#FFFFFF' || hex === '#ffffff') return true;
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  };
  const colorIsLight = isLightColor(themeColor);
  const titleOnColorClass = colorIsLight ? 'text-gray-900' : 'text-white';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, delay: index * 0.05 }}
        whileHover={{ y: -6 }}
        className="h-full"
      >
        <Card className="group relative overflow-hidden border transition-all duration-300 hover:shadow-xl hover:border-border/80 h-full flex flex-col py-0 gap-0">
          {/* Large colored area with gradient overlay for depth */}
          <div
            className="h-24 w-full shrink-0 relative flex flex-col justify-between p-3 overflow-hidden"
            style={{ backgroundColor: themeColor }}
          >
            {/* Subtle gradient overlay for depth */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(0,0,0,0.08) 100%)`,
              }}
            />
            {/* Favorite heart in top-left corner */}
            <div className="absolute top-2 left-2">
              {renderFavoriteButton(form.favorite ? '' : '')}
            </div>

            {/* Status indicator dot (after the favorite heart) */}
            <div className="absolute top-2 left-10">
              <span className={`relative flex size-2.5 ${form.published ? '' : ''}`}>
                {form.published && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full size-2.5 ${form.published ? 'bg-green-500' : 'bg-gray-400/60'}`} />
              </span>
            </div>

            {/* Title inside colored area */}
            <div className="flex-1 min-w-0 pl-6 pr-6 relative z-10">
              {isEditingTitle ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                  className={`h-6 text-base font-bold bg-white/20 border-white/30 placeholder:text-white/50 ${titleOnColorClass}`}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h3
                  className={`text-base font-bold leading-snug cursor-pointer hover:opacity-80 transition-opacity line-clamp-2 ${titleOnColorClass}`}
                  onClick={() => onEdit(form.id)}
                  title="Open in builder"
                >
                  {form.title}
                </h3>
              )}
            </div>

            {/* Question count badge */}
            <Badge
              className={`self-start text-[10px] px-2 py-0 h-5 ${
                colorIsLight
                  ? 'bg-black/10 text-gray-800 hover:bg-black/15'
                  : 'bg-white/20 text-white hover:bg-white/25'
              } border-0`}
            >
              {questionCount} question{questionCount !== 1 ? 's' : ''}
            </Badge>

            {/* Dropdown menu trigger overlaid */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${
                    colorIsLight ? 'hover:bg-black/10' : 'hover:bg-white/15'
                  } ${titleOnColorClass}`}
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
                  <Heart className={`size-4 mr-2 ${form.favorite ? 'fill-current text-red-500' : ''}`} />
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
              <p className="text-[10px] text-muted-foreground/60">
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
                  className="text-[10px] px-2 py-0 h-5"
                >
                  {form.published ? 'Published' : 'Draft'}
                </Badge>
                {responseCount > 0 ? (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 gap-1">
                    <BarChart2 className="size-3" />
                    {responseCount}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50">0 responses</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                {timeAgoText || formatDate(form.createdAt)}
              </span>
            </div>

            {/* Quick action buttons (visible on hover) */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[11px] gap-1"
                onClick={() => onEdit(form.id)}
              >
                <Pencil className="size-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[11px] gap-1"
                onClick={() => onPreview(form.id)}
              >
                <Eye className="size-3" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
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
              className="bg-destructive text-white hover:bg-destructive/90"
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
