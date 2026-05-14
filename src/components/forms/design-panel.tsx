'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FormQuestion, QuestionType, LogicRule, FormEnding, HiddenField } from '@/types/form';
import { useFormStore } from '@/store/form-store';
import { QUESTION_TYPES, THEME_PRESETS } from '@/lib/form-helpers';
import { LOGIC_UNSUPPORTED_TYPES, isChoiceQuestion, getDefaultField, getDefaultOperator, getConditionFields, getAvailableOperators, getChoiceOptions } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Type,
  AlignLeft,
  List,
  Image,
  ChevronDown,
  ThumbsUp,
  Mail,
  Phone,
  Hash,
  Globe,
  Calendar,
  Star,
  BarChart3,
  FileText,
  MessageSquare,
  Square,
  Palette,
  Settings2,
  Check,
  GitBranch,
  Plus,
  X,
  ArrowRight,
  Cog,
  CalendarClock,
  Search,
  ImageIcon,
  EyeOff,
  HandMetal,
  Trash2,
  Pencil,
  Save,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Type,
  AlignLeft,
  List,
  Image,
  ChevronDown,
  ThumbsUp,
  Mail,
  Phone,
  Hash,
  Globe,
  Calendar,
  Star,
  BarChart3,
  FileText,
  MessageSquare,
  Square,
};

interface DesignPanelProps {
  selectedQuestion: FormQuestion | null;
  onQuestionTypeChange: (type: QuestionType) => void;
}

export function DesignPanel({ selectedQuestion, onQuestionTypeChange }: DesignPanelProps) {
  const { currentForm, updateQuestion, updateForm } = useFormStore();

  if (!currentForm) return null;

  return (
    <div className="h-full bg-background border-l flex flex-col">
      <Tabs defaultValue="question" className="flex flex-col h-full">
        <TabsList className="w-full rounded-none border-b bg-transparent h-11 p-0">
          <TabsTrigger
            value="question"
            className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Settings2 className="size-4 mr-1.5" />
            Question
          </TabsTrigger>
          <TabsTrigger
            value="logic"
            className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <GitBranch className="size-4 mr-1.5" />
            Logic
          </TabsTrigger>
          <TabsTrigger
            value="design"
            className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Palette className="size-4 mr-1.5" />
            Design
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Cog className="size-4 mr-1.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="question" className="m-0 p-4 space-y-5">
            {selectedQuestion ? (
              <QuestionSettingsTab
                key={selectedQuestion.id}
                question={selectedQuestion}
                onQuestionTypeChange={onQuestionTypeChange}
              />
            ) : (
              <FormSettingsTab />
            )}
          </TabsContent>

          <TabsContent value="logic" className="m-0 p-4">
            {selectedQuestion ? (
              <LogicTab
                key={`logic-${selectedQuestion.id}`}
                question={selectedQuestion}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GitBranch className="size-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a question to add logic rules
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="design" className="m-0 p-4">
            <DesignTabContent />
          </TabsContent>

          <TabsContent value="settings" className="m-0 p-4">
            <FormSettingsAdvancedTab />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ── Logic Tab ──────────────────────────────────────────────────────────────



function LogicTab({ question }: { question: FormQuestion }) {
  const { currentForm, updateQuestion } = useFormStore();
  const logic = question.logic || [];

  const sortedQuestions = useMemo(
    () => [...(currentForm?.questions || [])].sort((a, b) => a.order - b.order),
    [currentForm?.questions]
  );

  // Target questions for "jump to" dropdown: exclude current question
  const targetQuestions = useMemo(
    () => sortedQuestions.filter((q) => q.id !== question.id),
    [sortedQuestions, question.id]
  );

  if (LOGIC_UNSUPPORTED_TYPES.includes(question.type)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <GitBranch className="size-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Logic is not available for this question type
        </p>
      </div>
    );
  }

  const addRule = () => {
    const newRule: LogicRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      condition: {
        field: getDefaultField(question),
        operator: getDefaultOperator(question),
        value: '',
      },
      action: {
        type: 'jump_to',
        targetQuestionId: '',
      },
    };
    updateQuestion(question.id, { logic: [...logic, newRule] });
  };

  const updateRule = (ruleId: string, updates: Partial<LogicRule>) => {
    const newLogic = logic.map((rule) =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    );
    updateQuestion(question.id, { logic: newLogic });
  };

  const removeRule = (ruleId: string) => {
    updateQuestion(question.id, { logic: logic.filter((r) => r.id !== ruleId) });
  };

  const updateJumpToQuestionId = (targetId: string) => {
    updateQuestion(question.id, {
      settings: { ...question.settings, jumpToQuestionId: targetId || undefined },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conditional Logic
        </Label>
        <p className="text-xs text-muted-foreground">
          Control which question comes next based on the answer to this question.
        </p>
      </div>

      <Separator />

      {/* Logic Rules */}
      {logic.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center border border-dashed rounded-lg bg-muted/30">
          <GitBranch className="size-6 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No logic rules yet</p>
          <Button variant="outline" size="sm" onClick={addRule} className="gap-1.5">
            <Plus className="size-3.5" />
            Add Logic Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {logic.map((rule, index) => (
            <LogicRuleEditor
              key={rule.id}
              rule={rule}
              index={index}
              question={question}
              targetQuestions={targetQuestions}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onRemove={() => removeRule(rule.id)}
            />
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addRule}
            className="w-full gap-1.5"
          >
            <Plus className="size-3.5" />
            Add another rule
          </Button>
        </div>
      )}

      <Separator />

      {/* Otherwise jump to */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Otherwise
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          If no condition matches, where should the form go?
        </p>
        <Select
          value={question.settings?.jumpToQuestionId || '__next__'}
          onValueChange={(val) => updateJumpToQuestionId(val === '__next__' ? '' : val)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__next__">
              <div className="flex items-center gap-2">
                <ArrowRight className="size-3.5 opacity-50" />
                Next question (default)
              </div>
            </SelectItem>
            {targetQuestions.map((q) => (
              <SelectItem key={q.id} value={q.id}>
                <div className="flex items-center gap-2">
                  <ArrowRight className="size-3.5 opacity-50" />
                  <span className="truncate">{q.title}</span>
                </div>
              </SelectItem>
            ))}
            <SelectItem value="__submit__">
              <div className="flex items-center gap-2">
                <Check className="size-3.5 opacity-50" />
                Submit form
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </motion.div>
  );
}

// ── Logic Rule Editor ─────────────────────────────────────────────────────

function LogicRuleEditor({
  rule,
  index,
  question,
  targetQuestions,
  onUpdate,
  onRemove,
}: {
  rule: LogicRule;
  index: number;
  question: FormQuestion;
  targetQuestions: FormQuestion[];
  onUpdate: (updates: Partial<LogicRule>) => void;
  onRemove: () => void;
}) {
  // Get condition field options based on question type
  const conditionFields = useMemo(() => getConditionFields(question), [question]);

  // Get available operators based on question type
  const availableOperators = useMemo(() => getAvailableOperators(question), [question]);

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20 relative">
      {/* Rule header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Rule {index + 1}
        </span>
        <button
          onClick={onRemove}
          className="size-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* IF condition */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-medium">IF</Label>
        <div className="grid grid-cols-1 gap-2">
          {/* Condition field selector */}
          <Select
            value={rule.condition.field}
            onValueChange={(val) =>
              onUpdate({
                condition: { ...rule.condition, field: val },
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {conditionFields.map((field) => (
                <SelectItem key={field.value} value={field.value}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator and value row */}
          <div className="flex gap-2">
            <Select
              value={rule.condition.operator}
              onValueChange={(val) =>
                onUpdate({
                  condition: {
                    ...rule.condition,
                    operator: val as LogicRule['condition']['operator'],
                  },
                })
              }
            >
              <SelectTrigger className="h-8 text-xs w-[130px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableOperators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Value input or selector — hidden for is_filled/is_empty since they don't need a value */}
            {rule.condition.operator !== 'is_filled' && rule.condition.operator !== 'is_empty' && (
              <>
                {isChoiceQuestion(question) && (rule.condition.operator === 'equals' || rule.condition.operator === 'not_equals') ? (
                  <Select
                    value={rule.condition.value}
                    onValueChange={(val) =>
                      onUpdate({
                        condition: { ...rule.condition, value: val },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      {getChoiceOptions(question).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={rule.condition.value}
                    onChange={(e) =>
                      onUpdate({
                        condition: { ...rule.condition, value: e.target.value },
                      })
                    }
                    placeholder="Value..."
                    className="h-8 text-xs flex-1"
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* THEN action type */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-medium">THEN</Label>
        <Select
          value={rule.action.type}
          onValueChange={(val) =>
            onUpdate({
              action: { type: val as 'jump_to' | 'show_ending', targetQuestionId: val === 'show_ending' ? '' : rule.action.targetQuestionId },
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="jump_to">
              <div className="flex items-center gap-2">
                <ArrowRight className="size-3.5 opacity-50" />
                Jump to question
              </div>
            </SelectItem>
            <SelectItem value="show_ending">
              <div className="flex items-center gap-2">
                <HandMetal className="size-3.5 opacity-50" />
                Show ending screen
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* THEN target (conditional on action type) */}
      {rule.action.type === 'jump_to' ? (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">JUMP TO</Label>
          <Select
            value={rule.action.targetQuestionId}
            onValueChange={(val) =>
              onUpdate({
                action: { ...rule.action, targetQuestionId: val },
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select target question" />
            </SelectTrigger>
            <SelectContent>
              {targetQuestions.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="size-3.5 opacity-50" />
                    <span className="truncate">{q.title}</span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="__submit__">
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 opacity-50" />
                  Submit form
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">SHOW ENDING</Label>
          <Select
            value={rule.action.targetQuestionId}
            onValueChange={(val) =>
              onUpdate({
                action: { ...rule.action, targetQuestionId: val },
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select ending" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                <div className="flex items-center gap-2">
                  <HandMetal className="size-3.5 opacity-50" />
                  Default ending
                </div>
              </SelectItem>
              {(useFormStore.getState().currentForm?.endings || []).map((ending) => (
                <SelectItem key={ending.id} value={ending.id}>
                  <div className="flex items-center gap-2">
                    <HandMetal className="size-3.5 opacity-50" />
                    <span className="truncate">{ending.title}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}



// ── Question Settings Tab ──────────────────────────────────────────────────

function QuestionSettingsTab({
  question,
  onQuestionTypeChange,
}: {
  question: FormQuestion;
  onQuestionTypeChange: (type: QuestionType) => void;
}) {
  const { updateQuestion } = useFormStore();
  const [placeholder, setPlaceholder] = useState(() => question.placeholder);
  const [description, setDescription] = useState(() => question.description);

  const handlePlaceholderBlur = useCallback(() => {
    if (placeholder !== question.placeholder) {
      updateQuestion(question.id, { placeholder });
    }
  }, [placeholder, question.placeholder, question.id, updateQuestion]);

  const handleDescriptionBlur = useCallback(() => {
    if (description !== question.description) {
      updateQuestion(question.id, { description });
    }
  }, [description, question.description, question.id, updateQuestion]);

  const hasPlaceholder = ['short_text', 'long_text', 'email', 'phone', 'number', 'website', 'date'].includes(question.type);
  const hasOptions = ['multiple_choice', 'picture_choice', 'dropdown'].includes(question.type);
  const hasSteps = question.type === 'rating' || question.type === 'opinion_scale';
  const hasNumberRange = question.type === 'number';
  const hasAllowMultiple = question.type === 'multiple_choice' || question.type === 'picture_choice';
  const hasLegalText = question.type === 'legal';
  const hasRedirect = question.type === 'ending';
  const isStatement = question.type === 'statement';
  const isEnding = question.type === 'ending';

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Question Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Question Type
        </Label>
        <Select
          value={question.type}
          onValueChange={(val) => onQuestionTypeChange(val as QuestionType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((qt) => {
              const Icon = ICON_MAP[qt.icon] || Type;
              return (
                <SelectItem key={qt.type} value={qt.type}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {qt.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Required Toggle */}
      {!isStatement && !isEnding && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">Required</Label>
          <Switch
            checked={question.required}
            onCheckedChange={(checked) =>
              updateQuestion(question.id, { required: checked })
            }
          />
        </div>
      )}

      {/* Description */}
      {!isEnding && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Add a description..."
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      )}

      {/* Placeholder */}
      {hasPlaceholder && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Placeholder
          </Label>
          <Input
            value={placeholder}
            onChange={(e) => setPlaceholder(e.target.value)}
            onBlur={handlePlaceholderBlur}
            placeholder="Enter placeholder text..."
            className="text-sm"
          />
        </div>
      )}

      {/* Steps for rating/opinion_scale */}
      {hasSteps && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Steps
          </Label>
          <Select
            value={String(question.settings?.steps || (question.type === 'rating' ? 5 : 10))}
            onValueChange={(val) =>
              updateQuestion(question.id, {
                settings: { ...question.settings, steps: parseInt(val) },
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {question.type === 'rating'
                ? [3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} stars
                    </SelectItem>
                  ))
                : [5, 6, 7, 8, 9, 10, 11].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      0–{n - 1}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>

          {question.type === 'opinion_scale' && (
            <div className="flex items-center justify-between">
              <Label className="text-sm">Start at 1</Label>
              <Switch
                checked={question.settings?.startAtOne ?? false}
                onCheckedChange={(checked) =>
                  updateQuestion(question.id, {
                    settings: { ...question.settings, startAtOne: checked },
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Number range */}
      {hasNumberRange && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Range
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1">Min</Label>
              <Input
                type="number"
                value={question.settings?.min ?? 0}
                onChange={(e) =>
                  updateQuestion(question.id, {
                    settings: { ...question.settings, min: parseInt(e.target.value) || 0 },
                  })
                }
                className="text-sm"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1">Max</Label>
              <Input
                type="number"
                value={question.settings?.max ?? 100}
                onChange={(e) =>
                  updateQuestion(question.id, {
                    settings: { ...question.settings, max: parseInt(e.target.value) || 100 },
                  })
                }
                className="text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Allow multiple selection */}
      {hasAllowMultiple && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">Allow multiple selections</Label>
          <Switch
            checked={question.settings?.allowMultiple ?? false}
            onCheckedChange={(checked) =>
              updateQuestion(question.id, {
                settings: { ...question.settings, allowMultiple: checked },
              })
            }
          />
        </div>
      )}

      {/* Randomize options */}
      {hasOptions && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">Randomize choices</Label>
          <Switch
            checked={question.settings?.randomize ?? false}
            onCheckedChange={(checked) =>
              updateQuestion(question.id, {
                settings: { ...question.settings, randomize: checked },
              })
            }
          />
        </div>
      )}

      {/* Legal text */}
      {hasLegalText && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Required Text
          </Label>
          <Input
            value={question.settings?.requiredText || 'I accept'}
            onChange={(e) =>
              updateQuestion(question.id, {
                settings: { ...question.settings, requiredText: e.target.value },
              })
            }
            className="text-sm"
          />
        </div>
      )}

      {/* Ending redirect */}
      {hasRedirect && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Redirect URL
          </Label>
          <Input
            value={question.settings?.redirectUrl || ''}
            onChange={(e) =>
              updateQuestion(question.id, {
                settings: { ...question.settings, redirectUrl: e.target.value },
              })
            }
            placeholder="https://example.com"
            className="text-sm"
          />
        </div>
      )}

      {/* Picture Choice - Image URLs per option */}
      {question.type === 'picture_choice' && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Option Images
          </Label>
          <p className="text-xs text-muted-foreground">
            Add an image URL for each picture choice option.
          </p>
          <div className="space-y-2">
            {question.options.map((option) => (
              <div key={option.id} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{option.label}</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="size-8 rounded border shrink-0 overflow-hidden bg-muted/30 flex items-center justify-center"
                  >
                    {option.image ? (
                      <img src={option.image} alt={option.label} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="size-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <Input
                    value={option.image || ''}
                    onChange={(e) => {
                      const newOptions = question.options.map((opt) =>
                        opt.id === option.id ? { ...opt, image: e.target.value || undefined } : opt
                      );
                      updateQuestion(question.id, { options: newOptions });
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="h-8 text-xs flex-1"
                  />
                  {option.image && (
                    <button
                      onClick={() => {
                        const newOptions = question.options.map((opt) =>
                          opt.id === option.id ? { ...opt, image: undefined } : opt
                        );
                        updateQuestion(question.id, { options: newOptions });
                      }}
                      className="size-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring */}
      {!isStatement && !isEnding && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Scoring
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Assign points to answers for quizzes
                </p>
              </div>
              <Switch
                checked={question.settings?.scoringEnabled ?? false}
                onCheckedChange={(checked) =>
                  updateQuestion(question.id, {
                    settings: { ...question.settings, scoringEnabled: checked },
                  })
                }
              />
            </div>

            {question.settings?.scoringEnabled && (
              <div className="space-y-3">
                {/* Choice questions: score per option */}
                {hasOptions && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Points per option</Label>
                    {question.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                          {opt.label}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={question.settings?.scoreValues?.[opt.id] ?? 0}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              settings: {
                                ...question.settings,
                                scoreValues: {
                                  ...(question.settings?.scoreValues || {}),
                                  [opt.id]: parseInt(e.target.value) || 0,
                                },
                              },
                            })
                          }
                          className="w-20 h-7 text-xs text-right"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Yes/No: score per answer */}
                {question.type === 'yes_no' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Points per answer</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex-1">Yes</span>
                      <Input
                        type="number"
                        min={0}
                        value={question.settings?.scoreValues?.['yes'] ?? 0}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            settings: {
                              ...question.settings,
                              scoreValues: {
                                ...(question.settings?.scoreValues || {}),
                                yes: parseInt(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-20 h-7 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex-1">No</span>
                      <Input
                        type="number"
                        min={0}
                        value={question.settings?.scoreValues?.['no'] ?? 0}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            settings: {
                              ...question.settings,
                              scoreValues: {
                                ...(question.settings?.scoreValues || {}),
                                no: parseInt(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-20 h-7 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                {/* Rating / Opinion Scale: points per unit or correct answer */}
                {hasSteps && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Points per unit</Label>
                      <p className="text-[10px] text-muted-foreground/60">
                        Score = value × points (e.g., 4 stars × 5 pts = 20)
                      </p>
                      <Input
                        type="number"
                        min={0}
                        value={question.settings?.points ?? 0}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            settings: { ...question.settings, points: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="w-24 h-7 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Correct answer (optional)</Label>
                      <p className="text-[10px] text-muted-foreground/60">
                        If set, points are only awarded for the exact correct answer
                      </p>
                      <Input
                        type="number"
                        value={question.settings?.correctAnswer || ''}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            settings: { ...question.settings, correctAnswer: e.target.value },
                          })
                        }
                        className="w-24 h-7 text-xs text-right"
                        placeholder="—"
                      />
                    </div>
                  </div>
                )}

                {/* Number question: points per unit or correct answer */}
                {hasNumberRange && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Points per unit</Label>
                      <p className="text-[10px] text-muted-foreground/60">
                        Score = answer value × points
                      </p>
                      <Input
                        type="number"
                        min={0}
                        value={question.settings?.points ?? 0}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            settings: { ...question.settings, points: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="w-24 h-7 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Correct answer (optional)</Label>
                      <p className="text-[10px] text-muted-foreground/60">
                        If set, full points are only awarded for the exact correct answer
                      </p>
                      <Input
                        type="number"
                        value={question.settings?.correctAnswer || ''}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            settings: { ...question.settings, correctAnswer: e.target.value },
                          })
                        }
                        className="w-24 h-7 text-xs text-right"
                        placeholder="—"
                      />
                    </div>
                  </div>
                )}

                {/* Text-based questions: correct answer + points */}
                {!hasOptions && !hasSteps && !hasNumberRange && question.type !== 'yes_no' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Correct answer</Label>
                    <Input
                      value={question.settings?.correctAnswer || ''}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          settings: { ...question.settings, correctAnswer: e.target.value },
                        })
                      }
                      placeholder="Enter correct answer..."
                      className="text-sm"
                    />
                    <Label className="text-xs text-muted-foreground">Points for correct answer</Label>
                    <Input
                      type="number"
                      min={0}
                      value={question.settings?.points ?? 0}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          settings: { ...question.settings, points: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-24 h-7 text-xs text-right"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

    </motion.div>
  );
}

// ── Form Settings (no question selected) ────────────────────────────────────

function FormSettingsTab() {
  const currentForm = useFormStore((s) => s.currentForm);
  const updateForm = useFormStore((s) => s.updateForm);

  const [welcomeTitle, setWelcomeTitle] = useState(() => currentForm?.welcomeTitle || '');
  const [welcomeMessage, setWelcomeMessage] = useState(() => currentForm?.welcomeMessage || '');
  const [endingTitle, setEndingTitle] = useState(() => currentForm?.endingTitle || '');
  const [endingMessage, setEndingMessage] = useState(() => currentForm?.endingMessage || '');

  if (!currentForm) return null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Welcome Screen
        </Label>
        <Input
          value={welcomeTitle}
          onChange={(e) => setWelcomeTitle(e.target.value)}
          onBlur={() => {
            if (welcomeTitle !== currentForm.welcomeTitle) {
              updateForm(currentForm.id, { welcomeTitle });
            }
          }}
          placeholder="Welcome title"
          className="text-sm"
        />
        <Textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          onBlur={() => {
            if (welcomeMessage !== currentForm.welcomeMessage) {
              updateForm(currentForm.id, { welcomeMessage });
            }
          }}
          placeholder="Welcome message"
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ending Screen
        </Label>
        <Input
          value={endingTitle}
          onChange={(e) => setEndingTitle(e.target.value)}
          onBlur={() => {
            if (endingTitle !== currentForm.endingTitle) {
              updateForm(currentForm.id, { endingTitle });
            }
          }}
          placeholder="Ending title"
          className="text-sm"
        />
        <Textarea
          value={endingMessage}
          onChange={(e) => setEndingMessage(e.target.value)}
          onBlur={() => {
            if (endingMessage !== currentForm.endingMessage) {
              updateForm(currentForm.id, { endingMessage });
            }
          }}
          placeholder="Ending message"
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <Separator />

      {/* Custom Endings */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Custom Endings
        </Label>
        <p className="text-xs text-muted-foreground">
          Add multiple ending screens that can be shown based on logic rules.
        </p>
        {(currentForm.endings || []).length === 0 ? (
          <div className="border border-dashed rounded-lg p-4 text-center bg-muted/20">
            <HandMetal className="size-5 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No custom endings yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(currentForm.endings || []).map((ending) => (
              <EndingEditor
                key={ending.id}
                ending={ending}
                formId={currentForm.id}
              />
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={async () => {
            try {
              const res = await fetch(`/api/forms/${currentForm.id}/endings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Custom Ending', message: 'Your response has been recorded.' }),
              });
              if (res.ok) {
                const newEnding = await res.json();
                updateForm(currentForm.id, {
                  endings: [...(currentForm.endings || []), newEnding],
                });
              }
            } catch { /* ignore */ }
          }}
        >
          <Plus className="size-3.5" />
          Add Ending
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label className="text-sm">Progress bar</Label>
        <Switch
          checked={currentForm.progressbar}
          onCheckedChange={(checked) =>
            updateForm(currentForm.id, { progressbar: checked })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Question numbers</Label>
        <Switch
          checked={currentForm.showQuestionNumbers}
          onCheckedChange={(checked) =>
            updateForm(currentForm.id, { showQuestionNumbers: checked })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Back navigation</Label>
        <Switch
          checked={currentForm.allowBackNavigation}
          onCheckedChange={(checked) =>
            updateForm(currentForm.id, { allowBackNavigation: checked })
          }
        />
      </div>
    </div>
  );
}

// ── Ending Editor ──────────────────────────────────────────────────────────

function EndingEditor({ ending, formId }: { ending: FormEnding; formId: string }) {
  const { updateForm } = useFormStore();
  const currentForm = useFormStore((s) => s.currentForm);
  const [title, setTitle] = useState(ending.title);
  const [message, setMessage] = useState(ending.message);
  const [redirectUrl, setRedirectUrl] = useState(ending.redirectUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/forms/${formId}/endings/${ending.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, redirectUrl: redirectUrl || null }),
      });
      if (res.ok && currentForm) {
        const updatedEnding = await res.json();
        updateForm(formId, {
          endings: (currentForm.endings || []).map((e) =>
            e.id === ending.id ? updatedEnding : e
          ),
        });
      }
    } catch { /* ignore */ } finally {
      setIsSaving(false);
    }
  }, [formId, ending.id, title, message, redirectUrl, currentForm, updateForm]);

  const handleDelete = useCallback(async () => {
    try {
      const res = await fetch(`/api/forms/${formId}/endings/${ending.id}`, {
        method: 'DELETE',
      });
      if (res.ok && currentForm) {
        updateForm(formId, {
          endings: (currentForm.endings || []).filter((e) => e.id !== ending.id),
        });
      }
    } catch { /* ignore */ }
  }, [formId, ending.id, currentForm, updateForm]);

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {ending.title || 'Custom Ending'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="size-6 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="Save"
          >
            <Save className="size-3" />
          </button>
          <button
            onClick={handleDelete}
            className="size-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ending title"
        className="h-7 text-xs"
        onBlur={handleSave}
      />
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ending message"
        rows={2}
        className="text-xs resize-none"
        onBlur={handleSave}
      />
      <Input
        value={redirectUrl}
        onChange={(e) => setRedirectUrl(e.target.value)}
        placeholder="Redirect URL (optional)"
        className="h-7 text-xs"
        onBlur={handleSave}
      />
    </div>
  );
}

// ── Design Tab ─────────────────────────────────────────────────────────────

function DesignTabContent() {
  const currentForm = useFormStore((s) => s.currentForm);
  const updateForm = useFormStore((s) => s.updateForm);

  if (!currentForm) return null;

  // Use form values directly as controlled state
  const localBg = currentForm.backgroundColor;
  const localText = currentForm.textColor;
  const localBtn = currentForm.buttonColor;
  const localBtnText = currentForm.buttonTextColor;

  const applyPreset = (preset: (typeof THEME_PRESETS)[number]) => {
    updateForm(currentForm.id, {
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor,
      buttonColor: preset.buttonColor,
      buttonTextColor: preset.buttonTextColor,
      theme: preset.name,
    });
  };

  const handleColorChange = (field: string, value: string) => {
    if (!/^#[0-9A-Fa-f]{0,6}$/.test(value) && value !== '') return;
    const updates: Record<string, string> = {};
    if (field === 'bg') updates.backgroundColor = value;
    if (field === 'text') updates.textColor = value;
    if (field === 'btn') updates.buttonColor = value;
    if (field === 'btnText') updates.buttonTextColor = value;
    // Only save when it's a complete hex
    if (value.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(value)) {
      updateForm(currentForm.id, updates);
    }
  };

  return (
    <div className="space-y-6">
      {/* Theme Presets */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Theme Presets
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {THEME_PRESETS.map((preset) => {
            const isActive = currentForm.theme === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="group relative flex flex-col items-center gap-1.5"
              >
                <div
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    isActive ? 'border-primary scale-105' : 'border-transparent hover:border-border'
                  }`}
                  style={{ backgroundColor: preset.backgroundColor }}
                >
                  <div className="w-full h-full rounded-md flex flex-col items-center justify-center gap-1 p-1 relative">
                    <div
                      className="w-6 h-1 rounded-full"
                      style={{ backgroundColor: preset.textColor }}
                    />
                    <div
                      className="w-4 h-1 rounded-full opacity-50"
                      style={{ backgroundColor: preset.textColor }}
                    />
                    <div
                      className="w-5 h-2 rounded-sm mt-1"
                      style={{ backgroundColor: preset.buttonColor, color: preset.buttonTextColor }}
                    />
                    {isActive && (
                      <div className="absolute top-0.5 right-0.5">
                        <Check className="size-3 text-primary" />
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Custom Colors */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Custom Colors
        </Label>
        <div className="space-y-3">
          <ColorInput
            label="Background"
            value={localBg}
            onChange={(v) => handleColorChange('bg', v)}
          />
          <ColorInput
            label="Text"
            value={localText}
            onChange={(v) => handleColorChange('text', v)}
          />
          <ColorInput
            label="Button"
            value={localBtn}
            onChange={(v) => handleColorChange('btn', v)}
          />
          <ColorInput
            label="Button Text"
            value={localBtnText}
            onChange={(v) => handleColorChange('btnText', v)}
          />
        </div>
      </div>

      <Separator />

      {/* Font */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Font Family
        </Label>
        <Select
          value={currentForm.fontFamily || 'sans'}
          onValueChange={(val) => updateForm(currentForm.id, { fontFamily: val })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sans">
              <span className="font-sans">Sans Serif</span>
            </SelectItem>
            <SelectItem value="serif">
              <span className="font-serif">Serif</span>
            </SelectItem>
            <SelectItem value="mono">
              <span className="font-mono">Monospace</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Progress bar</Label>
          <Switch
            checked={currentForm.progressbar}
            onCheckedChange={(checked) =>
              updateForm(currentForm.id, { progressbar: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Question numbers</Label>
          <Switch
            checked={currentForm.showQuestionNumbers}
            onCheckedChange={(checked) =>
              updateForm(currentForm.id, { showQuestionNumbers: checked })
            }
          />
        </div>
      </div>
    </div>
  );
}

// ── Color Input ────────────────────────────────────────────────────────────

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-8 rounded-md border shrink-0 cursor-pointer"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="opacity-0 w-full h-full cursor-pointer"
        />
      </div>
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs font-mono"
        />
      </div>
    </div>
  );
}

// ── Advanced Settings Tab (Settings gear tab) ─────────────────────────────

function FormSettingsAdvancedTab() {
  const currentForm = useFormStore((s) => s.currentForm);
  const updateForm = useFormStore((s) => s.updateForm);

  const [maxResponses, setMaxResponses] = useState(() => currentForm?.maxResponses ?? 0);
  const [closeDate, setCloseDate] = useState(() => currentForm?.closeDate ? currentForm.closeDate.split('T')[0] : '');
  const [metaTitle, setMetaTitle] = useState(() => currentForm?.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(() => currentForm?.metaDescription || '');

  // Hidden fields state
  const hiddenFields = useMemo(() => (currentForm?.hiddenFields || []) as HiddenField[], [currentForm?.hiddenFields]);
  const [editingFields, setEditingFields] = useState<Record<string, { name: string; defaultValue: string }>>({});

  if (!currentForm) return null;

  const addHiddenField = () => {
    const newField: HiddenField = {
      id: `hf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: '',
      defaultValue: '',
    };
    const updated = [...hiddenFields, newField];
    updateForm(currentForm.id, { hiddenFields: updated });
    setEditingFields((prev) => ({ ...prev, [newField.id]: { name: '', defaultValue: '' } }));
  };

  const updateHiddenField = (fieldId: string, updates: Partial<HiddenField>) => {
    const updated = hiddenFields.map((f) =>
      f.id === fieldId ? { ...f, ...updates } : f
    );
    updateForm(currentForm.id, { hiddenFields: updated });
  };

  const removeHiddenField = (fieldId: string) => {
    const updated = hiddenFields.filter((f) => f.id !== fieldId);
    updateForm(currentForm.id, { hiddenFields: updated });
    setEditingFields((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Form Settings
        </Label>
        <p className="text-xs text-muted-foreground">
          Configure how your form behaves and appears.
        </p>
      </div>

      <Separator />

      {/* Hidden Fields */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <EyeOff className="size-3.5 inline mr-1" />
            Hidden Fields
          </Label>
          <p className="text-xs text-muted-foreground">
            Pass data from URL parameters into your form responses. Use query params like <code className="text-[10px] bg-muted px-1 rounded">?source=twitter</code> to pre-fill hidden values.
          </p>
        </div>

        {hiddenFields.length === 0 ? (
          <div className="border border-dashed rounded-lg p-4 text-center bg-muted/20">
            <EyeOff className="size-5 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No hidden fields yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hiddenFields.map((field) => {
              const editing = editingFields[field.id];
              const name = editing ? editing.name : field.name;
              const defaultValue = editing ? editing.defaultValue : (field.defaultValue || '');

              return (
                <div key={field.id} className="border rounded-lg p-2.5 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {field.name || 'New Field'}
                    </span>
                    <button
                      onClick={() => removeHiddenField(field.id)}
                      className="size-5 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={name}
                      onChange={(e) =>
                        setEditingFields((prev) => ({
                          ...prev,
                          [field.id]: { ...prev[field.id]!, name: e.target.value },
                        }))
                      }
                      onBlur={() => {
                        if (name !== field.name) {
                          updateHiddenField(field.id, { name });
                        }
                      }}
                      placeholder="Field name"
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      value={defaultValue}
                      onChange={(e) =>
                        setEditingFields((prev) => ({
                          ...prev,
                          [field.id]: { ...prev[field.id]!, defaultValue: e.target.value },
                        }))
                      }
                      onBlur={() => {
                        if (defaultValue !== (field.defaultValue || '')) {
                          updateHiddenField(field.id, { defaultValue: defaultValue || undefined });
                        }
                      }}
                      placeholder="Default value"
                      className="h-7 text-xs flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    URL param: <code className="bg-muted px-0.5 rounded">?{name || 'fieldname'}=value</code>
                  </p>
                </div>
              );
            })}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={addHiddenField}
        >
          <Plus className="size-3.5" />
          Add Hidden Field
        </Button>
      </div>

      <Separator />

      {/* Progress Bar */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Progress Bar</Label>
          <p className="text-xs text-muted-foreground">Show progress indicator at top</p>
        </div>
        <Switch
          checked={currentForm.progressbar}
          onCheckedChange={(checked) =>
            updateForm(currentForm.id, { progressbar: checked })
          }
        />
      </div>

      {/* Question Numbers */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Question Numbers</Label>
          <p className="text-xs text-muted-foreground">Display &quot;1 of 5&quot; labels</p>
        </div>
        <Switch
          checked={currentForm.showQuestionNumbers}
          onCheckedChange={(checked) =>
            updateForm(currentForm.id, { showQuestionNumbers: checked })
          }
        />
      </div>

      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Back Navigation</Label>
          <p className="text-xs text-muted-foreground">Allow respondents to go back</p>
        </div>
        <Switch
          checked={currentForm.allowBackNavigation}
          onCheckedChange={(checked) =>
            updateForm(currentForm.id, { allowBackNavigation: checked })
          }
        />
      </div>

      <Separator />

      {/* Form Status */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Form Status
        </Label>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium">
              {currentForm.published ? 'Published' : 'Draft'}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentForm.published
                ? 'Your form is live and accepting responses'
                : 'Your form is not visible to respondents'}
            </p>
          </div>
          <Switch
            checked={currentForm.published}
            onCheckedChange={(checked) =>
              updateForm(currentForm.id, { published: checked })
            }
          />
        </div>
      </div>

      <Separator />

      {/* Response Limits */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Response Limits
        </Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            value={maxResponses}
            onChange={(e) => setMaxResponses(parseInt(e.target.value) || 0)}
            onBlur={() => {
              if (maxResponses !== (currentForm.maxResponses ?? 0)) {
                updateForm(currentForm.id, { maxResponses });
              }
            }}
            className="text-sm w-24"
          />
          <p className="text-xs text-muted-foreground">
            Max responses (0 = unlimited)
          </p>
        </div>
      </div>

      <Separator />

      {/* Close Date */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="size-3.5 inline mr-1" />
          Auto-Close Date
        </Label>
        <Input
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          onBlur={() => {
            const newValue = closeDate || null;
            const currentValue = currentForm.closeDate ? currentForm.closeDate.split('T')[0] : '';
            if (closeDate !== currentValue) {
              updateForm(currentForm.id, { closeDate: newValue });
            }
          }}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Form will stop accepting responses after this date. Leave empty for no auto-close.
        </p>
      </div>

      <Separator />

      {/* SEO Settings */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Search className="size-3.5 inline mr-1" />
          SEO Settings
        </Label>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Meta Title</Label>
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              onBlur={() => {
                if (metaTitle !== (currentForm.metaTitle || '')) {
                  updateForm(currentForm.id, { metaTitle });
                }
              }}
              placeholder={currentForm.title || 'Form title'}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Meta Description</Label>
            <Textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              onBlur={() => {
                if (metaDescription !== (currentForm.metaDescription || '')) {
                  updateForm(currentForm.id, { metaDescription });
                }
              }}
              placeholder="A brief description of your form for search engines and social sharing"
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
