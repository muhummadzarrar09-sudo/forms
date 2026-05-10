import type { QuestionType, FormQuestion, QuestionOption } from '@/types/form';

export const QUESTION_TYPES: { type: QuestionType; label: string; icon: string; category: string }[] = [
  { type: 'short_text', label: 'Short Text', icon: 'Type', category: 'Text' },
  { type: 'long_text', label: 'Long Text', icon: 'AlignLeft', category: 'Text' },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: 'List', category: 'Choices' },
  { type: 'picture_choice', label: 'Picture Choice', icon: 'Image', category: 'Choices' },
  { type: 'dropdown', label: 'Dropdown', icon: 'ChevronDown', category: 'Choices' },
  { type: 'yes_no', label: 'Yes/No', icon: 'ThumbsUp', category: 'Choices' },
  { type: 'email', label: 'Email', icon: 'Mail', category: 'Fields' },
  { type: 'phone', label: 'Phone Number', icon: 'Phone', category: 'Fields' },
  { type: 'number', label: 'Number', icon: 'Hash', category: 'Fields' },
  { type: 'website', label: 'Website', icon: 'Globe', category: 'Fields' },
  { type: 'date', label: 'Date', icon: 'Calendar', category: 'Fields' },
  { type: 'rating', label: 'Rating', icon: 'Star', category: 'Rating' },
  { type: 'opinion_scale', label: 'Opinion Scale', icon: 'BarChart3', category: 'Rating' },
  { type: 'legal', label: 'Legal', icon: 'FileText', category: 'Other' },
  { type: 'statement', label: 'Statement', icon: 'MessageSquare', category: 'Other' },
  { type: 'ending', label: 'Ending Screen', icon: 'Square', category: 'Other' },
];

export function createDefaultQuestion(type: QuestionType, formId: string, order: number): FormQuestion {
  const defaults: Record<string, Partial<FormQuestion>> = {
    short_text: { title: 'Your answer', placeholder: 'Type your answer here...' },
    long_text: { title: 'Your answer', placeholder: 'Type your answer here...' },
    multiple_choice: { title: 'Your choice', options: generateOptions(3) },
    picture_choice: { title: 'Your choice', options: generateOptions(3) },
    dropdown: { title: 'Your selection', options: generateOptions(3) },
    yes_no: { title: 'Yes or No?' },
    email: { title: 'Your email', placeholder: 'name@example.com' },
    phone: { title: 'Your phone number', placeholder: '+1 (555) 000-0000' },
    number: { title: 'Your answer', placeholder: 'Type a number...', settings: { min: 0, max: 100 } },
    website: { title: 'Your website', placeholder: 'https://example.com' },
    date: { title: 'Pick a date', placeholder: 'Select a date...' },
    rating: { title: 'How would you rate this?', settings: { steps: 5 } },
    opinion_scale: { title: 'How likely are you to recommend us?', settings: { steps: 10, startAtOne: false } },
    legal: { title: 'I accept the terms and conditions', required: true },
    statement: { title: 'This is a statement', description: 'It doesn\'t require an answer.' },
    ending: { title: 'Thank you!', description: 'Your response has been recorded.' },
  };

  return {
    id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    formId,
    type,
    title: defaults[type]?.title || 'Your question',
    description: defaults[type]?.description || '',
    required: defaults[type]?.required || false,
    order,
    options: defaults[type]?.options || [],
    imageUrls: [],
    settings: defaults[type]?.settings || {},
    placeholder: defaults[type]?.placeholder || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generateOptions(count: number): QuestionOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt_${Date.now()}_${i}`,
    label: `Option ${i + 1}`,
  }));
}

export function getQuestionTypeLabel(type: QuestionType): string {
  return QUESTION_TYPES.find(t => t.type === type)?.label || type;
}

export function getQuestionTypeIcon(type: QuestionType): string {
  return QUESTION_TYPES.find(t => t.type === type)?.icon || 'HelpCircle';
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function getCompletionRate(total: number, completed: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// Theme presets
export const THEME_PRESETS = [
  { name: 'default', backgroundColor: '#FFFFFF', textColor: '#333333', buttonColor: '#1A1A1A', buttonTextColor: '#FFFFFF' },
  { name: 'dark', backgroundColor: '#1A1A2E', textColor: '#FFFFFF', buttonColor: '#E94560', buttonTextColor: '#FFFFFF' },
  { name: 'warm', backgroundColor: '#FFF8F0', textColor: '#5D4037', buttonColor: '#FF6B35', buttonTextColor: '#FFFFFF' },
  { name: 'cool', backgroundColor: '#F0F4F8', textColor: '#2D3748', buttonColor: '#4299E1', buttonTextColor: '#FFFFFF' },
  { name: 'nature', backgroundColor: '#F0FFF4', textColor: '#22543D', buttonColor: '#38A169', buttonTextColor: '#FFFFFF' },
  { name: 'purple', backgroundColor: '#FAF5FF', textColor: '#44337A', buttonColor: '#805AD5', buttonTextColor: '#FFFFFF' },
  { name: 'sunset', backgroundColor: '#FFFAF0', textColor: '#7B341E', buttonColor: '#ED8936', buttonTextColor: '#FFFFFF' },
  { name: 'ocean', backgroundColor: '#EBF8FF', textColor: '#2A4365', buttonColor: '#3182CE', buttonTextColor: '#FFFFFF' },
];
