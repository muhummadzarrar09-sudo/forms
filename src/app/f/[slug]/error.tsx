'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PublicFormError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PublicFormError] Public form crashed:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <section className="max-w-md w-full text-center space-y-5 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mx-auto size-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="size-7 text-destructive" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">This form could not be loaded</h1>
          <p className="text-sm text-muted-foreground">
            A display error occurred while opening this public form. Please try again, or contact the form owner if it continues.
          </p>
        </div>
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      </section>
    </main>
  );
}
