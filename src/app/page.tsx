'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFormStore } from '@/store/form-store';
import { Dashboard } from '@/components/forms/dashboard';
import { FormBuilder } from '@/components/forms/form-builder';
import { FormFiller } from '@/components/forms/form-filler';
import { ResponsesViewer } from '@/components/forms/responses-viewer';
import { AnimatePresence, motion } from 'framer-motion';

function HomeContent() {
  const currentView = useFormStore((s) => s.currentView);
  const setCurrentView = useFormStore((s) => s.setCurrentView);
  const setSelectedFormId = useFormStore((s) => s.setSelectedFormId);
  const setShareMode = useFormStore((s) => s.setShareMode);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle URL query parameters for shareable links
  useEffect(() => {
    const formId = searchParams.get('form');
    const previewId = searchParams.get('preview');

    if (formId) {
      // Shareable link mode - open the form in fill mode with shareMode=true
      setSelectedFormId(formId);
      setCurrentView('fill');
      setShareMode(true);
      // Clean up URL params
      router.replace('/', { scroll: false });
    } else if (previewId) {
      // Preview mode - same as fill but for internal use (shareMode=false)
      setSelectedFormId(previewId);
      setCurrentView('fill');
      setShareMode(false);
      // Clean up URL params
      router.replace('/', { scroll: false });
    }
  }, [searchParams, setCurrentView, setSelectedFormId, setShareMode, router]);

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
      {currentView === 'fill' && (
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
  );
}
