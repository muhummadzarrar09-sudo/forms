'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: 'dashboard' | 'builder' | 'filler';
}

function Kbd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-muted px-2 text-xs font-mono font-medium text-muted-foreground shadow-[var(--shadow-1)] ${className}`}
    >
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  description,
}: {
  keys: React.ReactNode;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{description}</span>
      <div className="flex items-center gap-1">{keys}</div>
    </div>
  );
}

function ShortcutSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function KeyboardShortcuts({ open, onOpenChange, context }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {context === 'dashboard' && (
            <>
              <ShortcutSection title="Dashboard">
                <ShortcutRow
                  keys={<Kbd>N</Kbd>}
                  description="Create new form"
                />
                <ShortcutRow
                  keys={<Kbd>/</Kbd>}
                  description="Focus search"
                />
                <ShortcutRow
                  keys={<><Kbd>G</Kbd> <span className="text-xs text-muted-foreground">then</span> <Kbd>G</Kbd></>}
                  description="Toggle grid/list view"
                />
              </ShortcutSection>
            </>
          )}

          {context === 'builder' && (
            <>
              <ShortcutSection title="Navigation">
                <ShortcutRow
                  keys={<Kbd>Esc</Kbd>}
                  description="Back to dashboard"
                />
                <ShortcutRow
                  keys={<><Kbd>Ctrl</Kbd> <Kbd>P</Kbd></>}
                  description="Preview form"
                />
              </ShortcutSection>

              <ShortcutSection title="Questions">
                <ShortcutRow
                  keys={<><Kbd>+</Kbd> <span className="text-xs text-muted-foreground">or</span> <Kbd>=</Kbd></>}
                  description="Add new question"
                />
                <ShortcutRow
                  keys={<><Kbd>Del</Kbd> <span className="text-xs text-muted-foreground">or</span> <Kbd>⌫</Kbd></>}
                  description="Delete selected question"
                />
                <ShortcutRow
                  keys={<><Kbd>Ctrl</Kbd> <Kbd>S</Kbd></>}
                  description="Save form"
                />
              </ShortcutSection>

              <ShortcutSection title="Help">
                <ShortcutRow
                  keys={<Kbd>?</Kbd>}
                  description="Show keyboard shortcuts"
                />
              </ShortcutSection>
            </>
          )}

          {context === 'filler' && (
            <>
              <ShortcutSection title="Form Filling">
                <ShortcutRow
                  keys={<Kbd>Enter</Kbd>}
                  description="Continue / Next question"
                />
                <ShortcutRow
                  keys={<><Kbd>Alt</Kbd> <Kbd>←</Kbd></>}
                  description="Go back"
                />
              </ShortcutSection>
            </>
          )}

          {/* Always show filler shortcuts as reference */}
          {context !== 'filler' && (
            <ShortcutSection title="Form Filler (reference)">
              <ShortcutRow
                keys={<Kbd>Enter</Kbd>}
                description="Continue / Next question"
              />
              <ShortcutRow
                keys={<><Kbd>Alt</Kbd> <Kbd>←</Kbd></>}
                description="Go back"
              />
            </ShortcutSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
