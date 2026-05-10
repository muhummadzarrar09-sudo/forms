import { create } from 'zustand';
import type { AppView, Form, FormQuestion, QuestionType, QuestionOption } from '@/types/form';

interface FormState {
  // Navigation
  currentView: AppView;
  selectedFormId: string | null;
  shareMode: boolean;
  
  // Data
  forms: Form[];
  currentForm: Form | null;
  
  // Builder state
  selectedQuestionId: string | null;
  isAddingQuestion: boolean;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  
  // Actions
  setCurrentView: (view: AppView) => void;
  setSelectedFormId: (id: string | null) => void;
  setShareMode: (mode: boolean) => void;
  setForms: (forms: Form[]) => void;
  setCurrentForm: (form: Form | null) => void;
  setSelectedQuestionId: (id: string | null) => void;
  setIsAddingQuestion: (adding: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  
  // Form operations
  addForm: (form: Form) => void;
  updateForm: (id: string, updates: Partial<Form>) => void;
  removeForm: (id: string) => void;
  
  // Question operations
  addQuestion: (question: FormQuestion) => void;
  updateQuestion: (questionId: string, updates: Partial<FormQuestion>) => void;
  removeQuestion: (questionId: string) => void;
  reorderQuestions: (questionIds: string[]) => void;
  
  // Navigation helpers
  openDashboard: () => void;
  openBuilder: (formId: string) => void;
  openFiller: (formId: string) => void;
  openResponses: (formId: string) => void;
}

export const useFormStore = create<FormState>((set, get) => ({
  // Initial state
  currentView: 'dashboard',
  selectedFormId: null,
  shareMode: false,
  forms: [],
  currentForm: null,
  selectedQuestionId: null,
  isAddingQuestion: false,
  isLoading: false,
  isSaving: false,
  
  // Setters
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedFormId: (id) => set({ selectedFormId: id }),
  setShareMode: (mode) => set({ shareMode: mode }),
  setForms: (forms) => set({ forms }),
  setCurrentForm: (form) => set({ currentForm: form }),
  setSelectedQuestionId: (id) => set({ selectedQuestionId: id }),
  setIsAddingQuestion: (adding) => set({ isAddingQuestion: adding }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  
  // Form operations
  addForm: (form) => set((state) => ({ forms: [form, ...state.forms] })),
  updateForm: (id, updates) => set((state) => ({
    forms: state.forms.map(f => f.id === id ? { ...f, ...updates } : f),
    currentForm: state.currentForm?.id === id ? { ...state.currentForm, ...updates } : state.currentForm,
  })),
  removeForm: (id) => set((state) => ({
    forms: state.forms.filter(f => f.id !== id),
    currentForm: state.currentForm?.id === id ? null : state.currentForm,
  })),
  
  // Question operations
  addQuestion: (question) => set((state) => {
    if (!state.currentForm) return state;
    return {
      currentForm: {
        ...state.currentForm,
        questions: [...state.currentForm.questions, question],
      },
    };
  }),
  updateQuestion: (questionId, updates) => set((state) => {
    if (!state.currentForm) return state;
    return {
      currentForm: {
        ...state.currentForm,
        questions: state.currentForm.questions.map(q =>
          q.id === questionId ? { ...q, ...updates } : q
        ),
      },
    };
  }),
  removeQuestion: (questionId) => set((state) => {
    if (!state.currentForm) return state;
    return {
      currentForm: {
        ...state.currentForm,
        questions: state.currentForm.questions.filter(q => q.id !== questionId),
      },
      selectedQuestionId: state.selectedQuestionId === questionId ? null : state.selectedQuestionId,
    };
  }),
  reorderQuestions: (questionIds) => set((state) => {
    if (!state.currentForm) return state;
    const questionMap = new Map(state.currentForm.questions.map(q => [q.id, q]));
    const reordered = questionIds
      .map((id, index) => {
        const q = questionMap.get(id);
        return q ? { ...q, order: index } : null;
      })
      .filter(Boolean) as FormQuestion[];
    return {
      currentForm: { ...state.currentForm, questions: reordered },
    };
  }),
  
  // Navigation helpers
  openDashboard: () => set({ currentView: 'dashboard', selectedFormId: null, currentForm: null, selectedQuestionId: null, shareMode: false }),
  openBuilder: (formId) => set({ currentView: 'builder', selectedFormId: formId }),
  openFiller: (formId) => set({ currentView: 'fill', selectedFormId: formId, shareMode: false }),
  openResponses: (formId) => set({ currentView: 'responses', selectedFormId: formId }),
}));
