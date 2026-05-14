'use client';

import { useEffect, useRef } from 'react';
import type { Form } from '@/types/form';
import { useFormStore } from '@/store/form-store';
import { FormFiller } from '@/components/forms/form-filler';

interface FormFillerWrapperProps {
  form: Form;
}

export function FormFillerWrapper({ form }: FormFillerWrapperProps) {
  const initializedRef = useRef(false);
  const { setCurrentForm, setSelectedFormId, setShareMode } = useFormStore();

  useEffect(() => {
    // Set the form in the store for FormFiller to use
    setCurrentForm(form);
    setSelectedFormId(form.id);
    setShareMode(true);
    initializedRef.current = true;
  }, [form, setCurrentForm, setSelectedFormId, setShareMode]);

  return <FormFiller />;
}
