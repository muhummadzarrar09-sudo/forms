'use client';

import { useFormStore } from '@/store/form-store';
import { Dashboard } from '@/components/forms/dashboard';
import { FormBuilder } from '@/components/forms/form-builder';
import { FormFiller } from '@/components/forms/form-filler';
import { ResponsesViewer } from '@/components/forms/responses-viewer';
import { AnimatePresence, motion } from 'framer-motion';

export default function Home() {
  const currentView = useFormStore((s) => s.currentView);

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
