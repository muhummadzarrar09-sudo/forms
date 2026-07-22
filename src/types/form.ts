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
  | 'ending';

export interface QuestionOption {
  id: string;
  label: string;
  image?: string;
}

export interface LogicCondition {
  field: string; // option id for choice questions, otherwise the compared field/value
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_filled' | 'is_empty';
  value: string;
}

export interface LogicRule {
  id: string;
  // Retained for existing forms. Newer rules may combine conditions below.
  condition: LogicCondition;
  conditions?: LogicCondition[];
  conditionMatch?: 'all' | 'any';
  action: {
    type: 'jump_to' | 'show_ending'; // jump_to a question, or show_ending to show a specific ending
    targetQuestionId: string; // which question to jump to, or ending id if type is show_ending
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
  // Default jump target if no logic rule matches
  jumpToQuestionId?: string;
  // Scoring
  scoringEnabled?: boolean;
  scoreValues?: Record<string, number>; // optionId -> score value for choice questions
  correctAnswer?: string; // correct answer value for scoring
  points?: number; // points for correct answer
  // Import V2: show this question only when a prior answer matches.
  visibility?: {
    questionId: string;
    equals: string;
  };
  // Import V2: this link-based asset field still has owner contact placeholders
  // that must be edited before publish.
  requiresAssetContactSetup?: boolean;
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
  userId: string;
  createdAt: string;
  updatedAt: string;
  forms?: Form[];
  _count?: {
    forms: number;
  };
}

export interface FormEnding {
  id: string;
  formId: string;
  title: string;
  message: string;
  redirectUrl: string | null;
  showScore: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface HiddenField {
  id: string;
  name: string;
  defaultValue?: string;
}

export interface Form {
  id: string;
  title: string;
  description: string;
  slug: string | null;
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
  hiddenFields: HiddenField[];
  maxResponses: number;
  closeDate: string | null;
  metaTitle: string;
  metaDescription: string;
  userId: string;
  workspaceId: string | null;
  workspace?: Workspace | null;
  createdAt: string;
  updatedAt: string;
  questions: FormQuestion[];
  endings: FormEnding[];
  _count?: {
    responses: number;
  };
}

export interface FormResponse {
  id: string;
  formId: string;
  startedAt: string;
  completedAt: string | null;
  isPartial: boolean;
  score: number;
  metadata: Record<string, unknown>;
  answers: FormAnswer[];
}

export interface FormAnswer {
  id: string;
  responseId: string;
  questionId: string;
  value: string;
  score: number;
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
