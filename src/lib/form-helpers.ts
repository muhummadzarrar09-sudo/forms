import type { QuestionType, FormQuestion, QuestionOption } from '@/types/form';

export interface FormTemplateQuestion {
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  options?: string[];
  settings?: Record<string, unknown>;
  placeholder?: string;
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  questions: FormTemplateQuestion[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'customer-feedback',
    title: 'Customer Feedback Survey',
    description: 'Collect valuable feedback from your customers to improve your products and services.',
    icon: 'MessageSquare',
    color: '#E94560',
    questions: [
      { type: 'rating', title: 'How would you rate your overall experience?', required: true, settings: { steps: 5 } },
      { type: 'opinion_scale', title: 'How likely are you to recommend us to a friend?', required: true, settings: { steps: 10, startAtOne: false } },
      { type: 'multiple_choice', title: 'What aspect did you enjoy the most?', options: ['Product Quality', 'Customer Service', 'Pricing', 'Ease of Use', 'Other'], required: true },
      { type: 'long_text', title: 'What could we improve?', placeholder: 'Share your thoughts...', required: false },
      { type: 'multiple_choice', title: 'How did you hear about us?', options: ['Social Media', 'Friend/Referral', 'Search Engine', 'Advertisement', 'Other'] },
      { type: 'email', title: 'Would you like us to follow up with you?', required: false, placeholder: 'your@email.com' },
    ],
  },
  {
    id: 'event-registration',
    title: 'Event Registration',
    description: 'Register attendees for your event and collect all the information you need.',
    icon: 'Calendar',
    color: '#3182CE',
    questions: [
      { type: 'short_text', title: 'What is your full name?', required: true, placeholder: 'John Doe' },
      { type: 'email', title: 'What is your email address?', required: true, placeholder: 'you@example.com' },
      { type: 'phone', title: 'What is your phone number?', required: false, placeholder: '+1 (555) 000-0000' },
      { type: 'multiple_choice', title: 'Which ticket type would you like?', options: ['General Admission', 'VIP', 'Student', 'Group (5+)'], required: true },
      { type: 'multiple_choice', title: 'Do you have any dietary restrictions?', options: ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Other'] },
      { type: 'long_text', title: 'Any special requirements or notes?', placeholder: 'Let us know if you need any accommodations...', required: false },
      { type: 'legal', title: 'I agree to the event terms and conditions', required: true },
    ],
  },
  {
    id: 'employee-satisfaction',
    title: 'Employee Satisfaction',
    description: 'Measure employee happiness and engagement to build a better workplace.',
    icon: 'Users',
    color: '#38A169',
    questions: [
      { type: 'opinion_scale', title: 'On a scale of 0-10, how satisfied are you with your job?', required: true, settings: { steps: 10, startAtOne: false } },
      { type: 'rating', title: 'How would you rate your work-life balance?', required: true, settings: { steps: 5 } },
      { type: 'multiple_choice', title: 'Which department are you in?', options: ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Other'], required: true },
      { type: 'multiple_choice', title: 'How long have you been with the company?', options: ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years'], required: true },
      { type: 'yes_no', title: 'Do you feel valued at work?', required: true },
      { type: 'long_text', title: 'What would make your work experience better?', placeholder: 'Share your ideas...', required: false },
      { type: 'multiple_choice', title: 'How often do you feel stressed at work?', options: ['Rarely', 'Sometimes', 'Often', 'Very Often'], required: true },
      { type: 'opinion_scale', title: 'How likely are you to recommend this company as a workplace?', required: true, settings: { steps: 10, startAtOne: false } },
    ],
  },
  {
    id: 'contact-form',
    title: 'Contact Form',
    description: 'A simple and effective way for people to get in touch with you.',
    icon: 'Mail',
    color: '#ED8936',
    questions: [
      { type: 'short_text', title: 'What is your name?', required: true, placeholder: 'Your full name' },
      { type: 'email', title: 'What is your email address?', required: true, placeholder: 'you@example.com' },
      { type: 'dropdown', title: 'What is this regarding?', options: ['General Inquiry', 'Support', 'Partnership', 'Feedback', 'Other'], required: true },
      { type: 'long_text', title: 'Your message', required: true, placeholder: 'How can we help you?' },
    ],
  },
  {
    id: 'product-order',
    title: 'Product Order Form',
    description: 'Collect product orders with all the details you need to fulfill them.',
    icon: 'ShoppingCart',
    color: '#805AD5',
    questions: [
      { type: 'short_text', title: 'Full name', required: true, placeholder: 'John Doe' },
      { type: 'email', title: 'Email address', required: true, placeholder: 'you@example.com' },
      { type: 'phone', title: 'Phone number', required: true, placeholder: '+1 (555) 000-0000' },
      { type: 'multiple_choice', title: 'Which product would you like to order?', options: ['Starter Pack - $29', 'Pro Bundle - $59', 'Enterprise Suite - $99', 'Custom Plan'], required: true },
      { type: 'number', title: 'How many units?', required: true, placeholder: '1', settings: { min: 1, max: 100 } },
      { type: 'long_text', title: 'Shipping address', required: true, placeholder: 'Full address including zip code' },
      { type: 'multiple_choice', title: 'Shipping method', options: ['Standard (5-7 days)', 'Express (2-3 days)', 'Next Day'], required: true },
      { type: 'long_text', title: 'Special instructions', placeholder: 'Any special requests...', required: false },
    ],
  },
  {
    id: 'job-application',
    title: 'Job Application',
    description: 'Streamline your hiring process with a structured application form.',
    icon: 'Briefcase',
    color: '#D69E2E',
    questions: [
      { type: 'short_text', title: 'Full name', required: true, placeholder: 'Your full name' },
      { type: 'email', title: 'Email address', required: true, placeholder: 'you@example.com' },
      { type: 'phone', title: 'Phone number', required: true, placeholder: '+1 (555) 000-0000' },
      { type: 'dropdown', title: 'Position you are applying for', options: ['Software Engineer', 'Product Designer', 'Marketing Manager', 'Sales Representative', 'Customer Support', 'Other'], required: true },
      { type: 'multiple_choice', title: 'Employment type', options: ['Full-time', 'Part-time', 'Contract', 'Internship'], required: true },
      { type: 'short_text', title: 'LinkedIn profile URL', required: false, placeholder: 'https://linkedin.com/in/...' },
      { type: 'website', title: 'Portfolio or website', required: false, placeholder: 'https://...' },
      { type: 'long_text', title: 'Why are you interested in this position?', required: true, placeholder: 'Tell us what excites you about this role...' },
      { type: 'long_text', title: 'Relevant experience', required: true, placeholder: 'Describe your relevant work experience...' },
      { type: 'date', title: 'Earliest start date', required: true },
      { type: 'legal', title: 'I confirm that all information provided is accurate', required: true },
    ],
  },
  {
    id: 'quiz-knowledge',
    title: 'Quiz / Knowledge Test',
    description: 'Create an engaging quiz to test knowledge with scored multiple choice questions.',
    icon: 'GraduationCap',
    color: '#E53E3E',
    questions: [
      { type: 'statement', title: 'Welcome to the quiz!', description: 'Answer the following questions to test your knowledge. Good luck!' },
      { type: 'multiple_choice', title: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], required: true },
      { type: 'multiple_choice', title: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], required: true },
      { type: 'multiple_choice', title: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], required: true },
      { type: 'yes_no', title: 'The Great Wall of China is visible from space.', required: true },
      { type: 'multiple_choice', title: 'What element has the chemical symbol "O"?', options: ['Gold', 'Osmium', 'Oxygen', 'Oganesson'], required: true },
      { type: 'number', title: 'How many continents are there?', required: true, placeholder: 'Enter a number', settings: { min: 1, max: 10 } },
      { type: 'multiple_choice', title: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'], required: true },
      { type: 'ending', title: 'Quiz Complete!', description: 'Thank you for taking the quiz. Your results will be reviewed.' },
    ],
  },
  {
    id: 'newsletter-signup',
    title: 'Newsletter Signup',
    description: 'Grow your subscriber list with a quick and easy signup form.',
    icon: 'Newspaper',
    color: '#319795',
    questions: [
      { type: 'short_text', title: 'What is your name?', required: true, placeholder: 'Your first name' },
      { type: 'email', title: 'What is your email?', required: true, placeholder: 'you@example.com' },
      { type: 'multiple_choice', title: 'What topics are you interested in?', options: ['Technology', 'Design', 'Business', 'Lifestyle', 'Science'], required: true, settings: { allowMultiple: true } },
      { type: 'dropdown', title: 'How often would you like to receive updates?', options: ['Daily', 'Weekly', 'Monthly'], required: true },
      { type: 'legal', title: 'I agree to receive email communications', required: true },
    ],
  },
  {
    id: 'lead-qualification',
    title: 'Lead Qualification',
    description: 'Qualify inbound leads, identify intent, and route the right follow-up.',
    icon: 'Target',
    color: '#7C3AED',
    questions: [
      { type: 'short_text', title: 'What is your name?', required: true, placeholder: 'Full name' },
      { type: 'email', title: 'What is your work email?', required: true, placeholder: 'you@company.com' },
      { type: 'short_text', title: 'What company do you represent?', required: true },
      { type: 'multiple_choice', title: 'What are you looking to solve?', required: true, options: ['Generate more leads', 'Improve operations', 'Launch a new product', 'Get expert advice'] },
      { type: 'multiple_choice', title: 'What is your estimated budget?', required: true, options: ['Under $1,000', '$1,000–$5,000', '$5,000–$20,000', '$20,000+'] },
      { type: 'multiple_choice', title: 'When would you like to start?', required: true, options: ['Immediately', 'This month', 'This quarter', 'Just researching'] },
      { type: 'long_text', title: 'Anything else we should know?', placeholder: 'Goals, constraints, or context…' },
    ],
  },
  {
    id: 'project-intake',
    title: 'Client Project Intake',
    description: 'Collect the context needed to scope a strong client project.',
    icon: 'Briefcase',
    color: '#0EA5E9',
    questions: [
      { type: 'short_text', title: 'Your name', required: true },
      { type: 'email', title: 'Best email address', required: true },
      { type: 'short_text', title: 'Business or organization name', required: true },
      { type: 'long_text', title: 'Describe the project in your own words', required: true },
      { type: 'multiple_choice', title: 'What is the primary project goal?', required: true, options: ['More sales', 'More qualified leads', 'Better customer experience', 'Internal efficiency', 'Brand awareness'] },
      { type: 'long_text', title: 'What does success look like?', required: true },
      { type: 'date', title: 'Ideal launch or decision date' },
      { type: 'long_text', title: 'Share links, references, or inspiration', placeholder: 'URLs, competitors, examples…' },
    ],
  },
];

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
    logic: [],
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
  { name: 'default',   backgroundColor: '#FFFFFF', textColor: '#333333', buttonColor: '#1A1A1A', buttonTextColor: '#FFFFFF' },
  { name: 'dark',      backgroundColor: '#1A1A2E', textColor: '#FFFFFF', buttonColor: '#E94560', buttonTextColor: '#FFFFFF' },
  { name: 'midnight',  backgroundColor: '#0F172A', textColor: '#CBD5E1', buttonColor: '#7C3AED', buttonTextColor: '#FFFFFF' },
  { name: 'warm',      backgroundColor: '#FFF8F0', textColor: '#5D4037', buttonColor: '#FF6B35', buttonTextColor: '#FFFFFF' },
  { name: 'cool',      backgroundColor: '#F0F4F8', textColor: '#2D3748', buttonColor: '#4299E1', buttonTextColor: '#FFFFFF' },
  { name: 'nature',    backgroundColor: '#F0FFF4', textColor: '#22543D', buttonColor: '#38A169', buttonTextColor: '#FFFFFF' },
  { name: 'purple',    backgroundColor: '#FAF5FF', textColor: '#44337A', buttonColor: '#805AD5', buttonTextColor: '#FFFFFF' },
  { name: 'sunset',    backgroundColor: '#FFFAF0', textColor: '#7B341E', buttonColor: '#ED8936', buttonTextColor: '#FFFFFF' },
  { name: 'ocean',     backgroundColor: '#EBF8FF', textColor: '#2A4365', buttonColor: '#3182CE', buttonTextColor: '#FFFFFF' },
  { name: 'rose',      backgroundColor: '#FFF0F3', textColor: '#4A0010', buttonColor: '#E11D48', buttonTextColor: '#FFFFFF' },
  { name: 'sand',      backgroundColor: '#FAF7F2', textColor: '#3D2B1F', buttonColor: '#A16207', buttonTextColor: '#FFFFFF' },
  { name: 'forest',    backgroundColor: '#052E16', textColor: '#DCFCE7', buttonColor: '#22C55E', buttonTextColor: '#052E16' },
  { name: 'charcoal',  backgroundColor: '#18181B', textColor: '#F4F4F5', buttonColor: '#FAFAFA', buttonTextColor: '#18181B' },
  { name: 'indigo',    backgroundColor: '#EEF2FF', textColor: '#312E81', buttonColor: '#4F46E5', buttonTextColor: '#FFFFFF' },
  { name: 'slate',     backgroundColor: '#F8FAFC', textColor: '#0F172A', buttonColor: '#334155', buttonTextColor: '#FFFFFF' },
  { name: 'neon',      backgroundColor: '#050505', textColor: '#FFFFFF', buttonColor: '#00FF94', buttonTextColor: '#050505' },
];
