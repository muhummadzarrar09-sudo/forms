'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { FormQuestion, QuestionType } from '@/types/form';
import { useFormStore } from '@/store/form-store';
import { QUESTION_TYPES, THEME_PRESETS } from '@/lib/form-helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
            value="design"
            className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Palette className="size-4 mr-1.5" />
            Design
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

          <TabsContent value="design" className="m-0 p-4">
            <DesignTabContent />
          </TabsContent>
        </ScrollArea>
      </Tabs>
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
