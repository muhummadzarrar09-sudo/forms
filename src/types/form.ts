export type QuestionType = 
  | 'short_text'
  | 'long_text' 
  | 'multiple_choice'
  | 'dropdown'
  | 'email'
  | 'number'
  | 'rating'
  | 'opinion_scale'
  | 'yes_no'
  | 'date'
  | 'picture_choice'
  | 'phone'
  | 'website'
  | 'legal'
  | 'statement'
  | 'file_upload'
  | 'ending';

export interface QuestionOption {
  id: string;
  label: string;
  image?: string;
}

export interface LogicRule {
  id: string;
  condition: {
    field: string; // which option/value to check - for choice questions, this is the option id
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  };
  action: {
    type: 'jump_to'; // future: could add 'show' | 'hide'
    targetQuestionId: string; // which question to jump to
  };
}

export interface QuestionSettings {
  // For rating/opinion_scale
  steps?: number;
  startAtOne?: boolean;
  // For number
  min?: number;
  max?: number;
  // For multiple_choice/picture_choice
  allowMultiple?: boolean;
  randomize?: boolean;
  // For legal
  requiredText?: string;
  // For ending
  redirectUrl?: string;
  // For file_upload
  maxFileSize?: number; // in MB
  allowedTypes?: string; // e.g. 'pdf,docx,jpg,png' or '*' for all
  // Default jump target if no logic rule matches
  jumpToQuestionId?: string;
}

export interface FormQuestion {
  id: string;
  formId: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: QuestionOption[];
  imageUrls: string[];
  settings: QuestionSettings;
  logic: LogicRule[];
  placeholder: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormTheme {
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: string;
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  forms?: Form[];
  _count?: {
    forms: number;
  };
}

export interface Form {
  id: string;
  title: string;
  description: string;
  published: boolean;
  welcomeTitle: string;
  welcomeMessage: string;
  endingTitle: string;
  endingMessage: string;
  theme: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: string;
  logoUrl: string | null;
  coverUrl: string | null;
  progressbar: boolean;
  showQuestionNumbers: boolean;
  allowBackNavigation: boolean;
  favorite: boolean;
  archived: boolean;
  tags: string[];
  maxResponses: number;
  closeDate: string | null;
  metaTitle: string;
  metaDescription: string;
  workspaceId: string | null;
  workspace?: Workspace;
  createdAt: string;
  updatedAt: string;
  questions: FormQuestion[];
  _count?: {
    responses: number;
  };
}

export interface FormResponse {
  id: string;
  formId: string;
  startedAt: string;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  answers: FormAnswer[];
}

export interface FormAnswer {
  id: string;
  responseId: string;
  questionId: string;
  value: string;
  question?: FormQuestion;
}

export type AppView = 'dashboard' | 'builder' | 'fill' | 'responses';

export interface FormSummary {
  totalResponses: number;
  completionRate: number;
  averageTime: number;
  questionSummaries: QuestionSummary[];
}

export interface QuestionSummary {
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  totalAnswers: number;
  // For choice questions
  choiceCounts?: Record<string, number>;
  // For number/rating/scale
  average?: number;
  min?: number;
  max?: number;
  // For text questions
  textAnswers?: string[];
}
