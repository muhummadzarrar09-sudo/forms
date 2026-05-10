'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Form } from '@/types/form';
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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface FormCardProps {
  form: Form;
  onEdit: (formId: string) => void;
  onPreview: (formId: string) => void;
  onViewResponses: (formId: string) => void;
  onDelete: (formId: string) => void;
  onTitleUpdate: (formId: string, title: string) => void;
  onPublish?: (formId: string, published: boolean) => void;
  onDuplicate?: (form: Form) => void;
  index: number;
  viewMode: 'grid' | 'list';
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
  index,
  viewMode,
}: FormCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(form.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const themeColor = getThemeColor(form.backgroundColor);
  const responseCount = form._count?.responses ?? 0;

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
                </div>

                {/* Status badge */}
                <Badge
                  variant={form.published ? 'default' : 'secondary'}
                  className="shrink-0 text-[10px] px-2 py-0 h-5"
                >
                  {form.published ? 'Published' : 'Draft'}
                </Badge>

                {/* Response count */}
                <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Users className="size-3.5" />
                  <span>{responseCount}</span>
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
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                        <Share2 className="size-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewResponses(form.id)}>
                        <BarChart3 className="size-4 mr-2" />
                        View Responses
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleDuplicate}
                        disabled={isDuplicating}
                      >
                        <Copy className="size-4 mr-2" />
                        {isDuplicating ? 'Duplicating...' : 'Duplicate'}
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
        whileHover={{ y: -4 }}
        className="h-full"
      >
        <Card className="group relative overflow-hidden border transition-all duration-300 hover:shadow-lg hover:border-border/80 h-full flex flex-col py-0 gap-0">
          {/* Large colored area with title */}
          <div
            className="h-20 w-full shrink-0 relative flex flex-col justify-between p-3"
            style={{ backgroundColor: themeColor }}
          >
            {/* Title inside colored area */}
            <div className="flex-1 min-w-0 pr-6">
              {isEditingTitle ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                  className={`h-6 text-sm font-semibold bg-white/20 border-white/30 placeholder:text-white/50 ${titleOnColorClass}`}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h3
                  className={`text-sm font-semibold leading-snug cursor-pointer hover:opacity-80 transition-opacity line-clamp-2 ${titleOnColorClass}`}
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to edit title"
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
              <DropdownMenuContent align="end" className="w-44">
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
                <DropdownMenuItem
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                >
                  <Copy className="size-4 mr-2" />
                  {isDuplicating ? 'Duplicating...' : 'Duplicate'}
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

          <CardContent className="p-4 flex flex-col flex-1 gap-2">
            {/* Description */}
            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
              {form.description || 'No description'}
            </p>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Footer row */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Badge
                  variant={form.published ? 'default' : 'secondary'}
                  className="text-[10px] px-2 py-0 h-5"
                >
                  {form.published ? 'Published' : 'Draft'}
                </Badge>
                {responseCount > 0 && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 gap-1">
                    <Users className="size-3" />
                    {responseCount}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(form.createdAt)}
              </span>
            </div>

            {/* Quick action buttons (visible on hover) */}
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => onEdit(form.id)}
              >
                <Pencil className="size-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => onPreview(form.id)}
              >
                <Eye className="size-3 mr-1" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
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
