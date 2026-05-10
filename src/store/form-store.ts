import { create } from 'zustand';
import type { AppView, Form, FormQuestion, QuestionType, QuestionOption, Workspace } from '@/types/form';

export interface FormNotification {
  id: string;
  formId: string;
  formTitle: string;
  type: 'new_response' | 'response_milestone' | 'form_published';
  message: string;
  count: number;
  timestamp: string;
  read: boolean;
}

interface FormState {
  // Navigation
  currentView: AppView;
  selectedFormId: string | null;
  shareMode: boolean;

  // Data
  forms: Form[];
  currentForm: Form | null;
  workspaces: Workspace[];

  // Builder state
  selectedQuestionId: string | null;
  isAddingQuestion: boolean;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Notifications
  notifications: FormNotification[];

  // Actions
  setCurrentView: (view: AppView) => void;
  setSelectedFormId: (id: string | null) => void;
  setShareMode: (mode: boolean) => void;
  setForms: (forms: Form[]) => void;
  setCurrentForm: (form: Form | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
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

  // Notification operations
  addNotification: (notification: FormNotification) => void;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  checkForNewResponses: () => void;

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
  workspaces: [],
  selectedQuestionId: null,
  isAddingQuestion: false,
  isLoading: false,
  isSaving: false,
  notifications: [],
  
  // Setters
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedFormId: (id) => set({ selectedFormId: id }),
  setShareMode: (mode) => set({ shareMode: mode }),
  setForms: (forms) => set({ forms }),
  setCurrentForm: (form) => set({ currentForm: form }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) => set((state) => ({ workspaces: [...state.workspaces, workspace] })),
  updateWorkspace: (id, updates) => set((state) => ({
    workspaces: state.workspaces.map(w => w.id === id ? { ...w, ...updates } : w),
  })),
  removeWorkspace: (id) => set((state) => ({
    workspaces: state.workspaces.filter(w => w.id !== id),
    // Also update any forms that were in this workspace
    forms: state.forms.map(f => f.workspaceId === id ? { ...f, workspaceId: null, workspace: undefined } : f),
  })),
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

  // Notification operations
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications].slice(0, 50), // keep last 50
  })),
  markNotificationRead: (notificationId) => set((state) => ({
    notifications: state.notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ),
  })),
  clearNotifications: () => {
    // Also clear stored response counts in localStorage
    try {
      localStorage.removeItem('forms-responseCounts');
    } catch { /* ignore */ }
    set({ notifications: [] });
  },
  checkForNewResponses: () => {
    const { forms } = get();
    try {
      // FIX 6: Compare form._count.responses against localStorage-persisted count
      const storedCountsJson = localStorage.getItem('forms-responseCounts');
      const storedCounts: Record<string, number> = storedCountsJson ? JSON.parse(storedCountsJson) : {};

      const newNotifications: FormNotification[] = [];
      const updatedCounts: Record<string, number> = { ...storedCounts };

      for (const form of forms) {
        const currentCount = form._count?.responses ?? 0;
        const previousCount = storedCounts[form.id] ?? 0;

        // If current count is higher than the stored count, there are new responses
        if (currentCount > previousCount && previousCount > 0) {
          const newCount = currentCount - previousCount;
          const notifId = `notif_${form.id}_${Date.now()}`;
          newNotifications.push({
            id: notifId,
            formId: form.id,
            formTitle: form.title,
            type: newCount === 1 ? 'new_response' : 'response_milestone',
            message: `"${form.title}" received ${newCount} new response${newCount > 1 ? 's' : ''}`,
            count: currentCount,
            timestamp: new Date().toISOString(),
            read: false,
          });
        }

        // Update stored count to current count
        updatedCounts[form.id] = currentCount;
      }

      if (newNotifications.length > 0) {
        set((state) => ({
          notifications: [...newNotifications, ...state.notifications].slice(0, 50),
        }));
      }

      // Save updated counts
      localStorage.setItem('forms-responseCounts', JSON.stringify(updatedCounts));
    } catch { /* ignore localStorage errors */ }
  },
}));
