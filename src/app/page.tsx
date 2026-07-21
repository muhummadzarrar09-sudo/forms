'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useFormStore } from '@/store/form-store';
import { Dashboard } from '@/components/forms/dashboard';
import { FormBuilder } from '@/components/forms/form-builder';
import { FormFiller } from '@/components/forms/form-filler';
import { ResponsesViewer } from '@/components/forms/responses-viewer';
import { LoginPage } from '@/components/login-page';
import { ErrorBoundary } from '@/components/error-boundary';
import { AnimatePresence, motion } from 'framer-motion';

function HomeContent() {
  const currentView = useFormStore((s) => s.currentView);
  const setCurrentView = useFormStore((s) => s.setCurrentView);
  const setSelectedFormId = useFormStore((s) => s.setSelectedFormId);
  const setShareMode = useFormStore((s) => s.setShareMode);
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Keep the visible view synchronized with the URL. Store navigation writes a
  // history entry; browser Back/Forward changes this URL and restores the
  // corresponding in-app view instead of leaving the app.
  useEffect(() => {
    const formId = searchParams.get('form');
    const view = searchParams.get('view');

    if (formId && view === 'builder') {
      setSelectedFormId(formId);
      setCurrentView('builder');
      setShareMode(false);
      return;
    }
    if (formId && view === 'responses') {
      setSelectedFormId(formId);
      setCurrentView('responses');
      setShareMode(false);
      return;
    }
    if (formId && view === 'preview') {
      setSelectedFormId(formId);
      setCurrentView('fill');
      setShareMode(false);
      return;
    }
    if (formId) {
      // Legacy public ID links remain supported during the transition. New
      // public links use /f/:slug and bypass this authenticated shell.
      setSelectedFormId(formId);
      setCurrentView('fill');
      setShareMode(true);
      return;
    }

    setSelectedFormId(null);
    setCurrentView('dashboard');
    setShareMode(false);
  }, [searchParams, setCurrentView, setSelectedFormId, setShareMode]);

  // If in share/preview mode (fill view), show the form filler regardless of auth
  if (currentView === 'fill') {
    return (
      <motion.div
        key="fill"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50"
      >
        <FormFiller />
      </motion.div>
    );
  }

  // For all other views, require authentication
  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <AnimatePresence mode="wait">
      {currentView === 'dashboard' && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Dashboard />
        </motion.div>
      )}
      {currentView === 'builder' && (
        <motion.div
          key="builder"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <FormBuilder />
        </motion.div>
      )}
      {currentView === 'responses' && (
        <motion.div
          key="responses"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <ResponsesViewer />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </ErrorBoundary>
  );
}
