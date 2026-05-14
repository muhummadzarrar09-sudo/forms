'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Form } from '@/types/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Share2,
  Link2,
  Code2,
  Settings2,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Users,
  Globe,
  Lock,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFormStore } from '@/store/form-store';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form;
  onPublish?: () => void;
}

export function ShareDialog({ open, onOpenChange, form, onPublish }: ShareDialogProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const updateForm = useFormStore((s) => s.updateForm);

  // Use slug-based URL when available, fall back to ID-based URL
  const formPath = form.slug ? `/f/${form.slug}` : `?form=${form.id}`;
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${formPath}`
    : formPath;

  const embedCode = `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" marginheight="0" marginwidth="0">Loading...</iframe>`;

  const responseCount = form._count?.responses ?? 0;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast({ title: 'Link copied!', description: 'Shareable link copied to clipboard.' });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  }, [shareUrl]);

  const handleCopyEmbed = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      toast({ title: 'Embed code copied!', description: 'Paste this into your website HTML.' });
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  }, [embedCode]);

  const handleTogglePublished = useCallback(async () => {
    const newPublished = !form.published;
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newPublished }),
      });
      if (res.ok) {
        const saved = await res.json();
        updateForm(form.id, { published: newPublished });
        toast({
          title: newPublished ? 'Form published' : 'Form unpublished',
          description: newPublished
            ? 'Your form is now accepting responses.'
            : 'Your form is now in draft mode.',
        });
        onPublish?.();
      }
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  }, [form.id, form.published, updateForm, onPublish]);

  const handleOpenLink = useCallback(() => {
    window.open(shareUrl, '_blank');
  }, [shareUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5 text-primary" />
            Share &ldquo;{form.title}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Share your form via link or embed it on your website.
          </DialogDescription>
        </DialogHeader>

        {/* Status banner */}
        <div className="px-6">
          {!form.published && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
            >
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  This form is in draft mode
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Publish your form to start accepting responses.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
                onClick={handleTogglePublished}
              >
                Publish
              </Button>
            </motion.div>
          )}

          {form.published && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
            >
              <Globe className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Form is live
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  This form is accepting responses.
                </p>
              </div>
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                <Users className="size-3 mr-1" />
                {responseCount} {responseCount === 1 ? 'response' : 'responses'}
              </Badge>
            </motion.div>
          )}
        </div>

        <Tabs defaultValue="link" className="px-6">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1 gap-1.5">
              <Link2 className="size-3.5" />
              Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1 gap-1.5">
              <Code2 className="size-3.5" />
              Embed
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-1.5">
              <Settings2 className="size-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Shareable link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="pr-10 text-sm font-mono bg-muted/50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {form.published ? (
                      <Globe className="size-3.5 text-emerald-500" />
                    ) : (
                      <Lock className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCopyLink}
                >
                  <AnimatePresence mode="wait">
                    {copiedLink ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <Check className="size-4 text-emerald-500" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        <Copy className="size-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                className="flex-1 gap-2"
                onClick={handleCopyLink}
              >
                {copiedLink ? (
                  <>
                    <Check className="size-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleOpenLink}
              >
                <ExternalLink className="size-4" />
                Open
              </Button>
            </div>
          </TabsContent>

          {/* Embed Tab */}
          <TabsContent value="embed" className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Embed code</label>
              <div className="relative rounded-lg border bg-muted/30 p-3">
                <pre className="text-xs font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all">
                  {embedCode}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 gap-1.5 text-xs"
                  onClick={handleCopyEmbed}
                >
                  <AnimatePresence mode="wait">
                    {copiedEmbed ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="size-3 text-emerald-500" />
                        Copied!
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Copy className="size-3" />
                        Copy
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>

            <Button
              variant="default"
              className="w-full gap-2"
              onClick={handleCopyEmbed}
            >
              {copiedEmbed ? (
                <>
                  <Check className="size-4" />
                  Embed Code Copied!
                </>
              ) : (
                <>
                  <Code2 className="size-4" />
                  Copy Embed Code
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Paste this iframe code into your website&apos;s HTML to embed the form.
            </p>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <div className="space-y-4">
              {/* Accept Responses Toggle */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card">
                <div className="flex items-start gap-3">
                  <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${form.published ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                    {form.published ? (
                      <Globe className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Lock className="size-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Accept responses</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {form.published
                        ? 'Your form is live and accepting responses.'
                        : 'Publish your form to start collecting responses.'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.published}
                  onCheckedChange={handleTogglePublished}
                />
              </div>

              <Separator />

              {/* Response stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Total responses</p>
                  <p className="text-2xl font-bold mt-1">{responseCount}</p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1.5">
                    <Badge
                      variant={form.published ? 'default' : 'secondary'}
                      className={form.published ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      {form.published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Share this form with anyone using the link above.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
