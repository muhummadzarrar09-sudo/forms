# Task 11: Conditional Logic (Question Jumps)

## Agent: logic-agent

## Task Summary
Add conditional logic (question jumps) feature - one of Typeform's most powerful features. Allows form builders to create rules that control which question a respondent sees next based on their answer to the current question.

## Changes Made

### 1. Data Model (`prisma/schema.prisma`)
- Added `logic String @default("[]")` field to Question model for storing JSON array of logic rules

### 2. TypeScript Types (`src/types/form.ts`)
- Added `LogicRule` interface with:
  - `id: string` — unique rule identifier
  - `condition: { field, operator, value }` — the condition to evaluate
  - `action: { type: 'jump_to', targetQuestionId }` — what to do when condition matches
- Added `logic: LogicRule[]` to `FormQuestion` interface
- Added `jumpToQuestionId?: string` to `QuestionSettings` for default "otherwise" jump target

### 3. API Routes
- Updated all API routes to serialize/deserialize `logic` field with `JSON.parse(q.logic || '[]')` safety:
  - `src/app/api/forms/route.ts` — GET and POST
  - `src/app/api/forms/[id]/route.ts` — GET and PUT
  - `src/app/api/forms/[id]/questions/route.ts` — PUT (includes logic in body type and JSON.stringify on create)
  - `src/app/api/forms/[id]/duplicate/route.ts` — POST (copies logic with fallback)

### 4. Form Helpers (`src/lib/form-helpers.ts`)
- Added `logic: []` to `createDefaultQuestion` default object

### 5. Design Panel - Logic Tab (`src/components/forms/design-panel.tsx`)
- Added third "Logic" tab with GitBranch icon
- LogicTab component with:
  - Empty state with dashed border and "Add Logic Rule" button
  - LogicRuleEditor for each rule with IF/THEN condition/action UI
  - Context-aware condition fields per question type (options for choice, Yes/No, Value, Answer)
  - Context-aware operators (equals/not_equals for choices, +greater_than/less_than for numeric, +contains for text)
  - Jump target dropdown (all other questions + Submit form)
  - Remove rule button
  - "Otherwise" default jump target dropdown
  - Disabled for statement/ending question types

### 6. Form Filler Logic Evaluation (`src/components/forms/form-filler.tsx`)
- Added `evaluateLogicRule` callback with question-type-specific evaluation:
  - Choice questions: checks selected option ID against condition field
  - Yes/No: checks answer against yes/no condition
  - Numeric: supports equals/not_equals/greater_than/less_than
  - Text: supports equals/not_equals/contains
- Modified `goNext` to evaluate logic rules:
  1. Check each rule in order, jump to target if match found
  2. If target is "__submit__", trigger form submission
  3. If no rule matches, check jumpToQuestionId (otherwise target)
  4. Fall through to next question as default

### 7. Auto-save
- Added `logic` to auto-save hash in `form-builder.tsx` so logic changes trigger saves

## Key Design Decisions
- Logic rules stored as JSON string in DB (same pattern as options/settings)
- Safety fallback `JSON.parse(q.logic || '[]')` handles edge cases with Prisma client caching
- "__submit__" sentinel value for "Submit form" target (not a real question ID)
- "__next__" sentinel value for "Next question" in Otherwise dropdown (represents default flow)
- Condition field for choice questions uses option IDs (not labels) for reliable matching
- Logic evaluation is ordered (first matching rule wins)
