'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { QuestionSummary, QuestionType } from '@/types/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
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
  Quote,
  TrendingUp,
  Minus,
  Maximize2,
} from 'lucide-react';
import { getQuestionTypeLabel, formatDuration } from '@/lib/form-helpers';

interface QuestionSummaryProps {
  summary: QuestionSummary;
  questionIndex: number;
  totalQuestions: number;
}

const QUESTION_TYPE_ICONS: Record<QuestionType, React.ElementType> = {
  short_text: Type,
  long_text: AlignLeft,
  multiple_choice: List,
  picture_choice: Image,
  dropdown: ChevronDown,
  yes_no: ThumbsUp,
  email: Mail,
  phone: Phone,
  number: Hash,
  website: Globe,
  date: Calendar,
  rating: Star,
  opinion_scale: BarChart3,
  legal: FileText,
  statement: MessageSquare,
  ending: Quote,
};

const CHOICE_TYPES: QuestionType[] = ['multiple_choice', 'picture_choice', 'dropdown', 'yes_no'];
const RATING_TYPES: QuestionType[] = ['rating', 'opinion_scale'];
const TEXT_TYPES: QuestionType[] = ['short_text', 'long_text', 'email', 'phone', 'website'];
const NUMBER_TYPE: QuestionType = 'number';
const DATE_TYPE: QuestionType = 'date';
const STATEMENT_TYPES: QuestionType[] = ['statement', 'legal'];

// A compact data-vis palette. Each color is at least 3:1 against both the
// light and dark analytics card surfaces; ordering is carried by labels too.
const CHART_COLORS = [
  '#2563EB',
  '#0F766E',
  '#B45309',
  '#7C3AED',
  '#C2410C',
];

export function QuestionSummaryCard({ summary, questionIndex, totalQuestions }: QuestionSummaryProps) {
  const Icon = QUESTION_TYPE_ICONS[summary.questionType] || MessageSquare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: questionIndex * 0.05 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    {questionIndex + 1} of {totalQuestions}
                  </span>
                  <Badge variant="secondary" className="min-h-7 px-2 text-xs">
                    {getQuestionTypeLabel(summary.questionType)}
                  </Badge>
                </div>
                <CardTitle className="text-base leading-snug break-words">
                  {summary.questionTitle}
                </CardTitle>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold">{summary.totalAnswers}</p>
              <p className="text-xs text-muted-foreground">answers</p>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {summary.totalAnswers === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="size-8 mb-2 opacity-40" />
              <p className="text-sm">No answers yet</p>
            </div>
          ) : (
            <>
              {CHOICE_TYPES.includes(summary.questionType) && (
                <ChoiceSummary choiceCounts={summary.choiceCounts ?? {}} />
              )}
              {RATING_TYPES.includes(summary.questionType) && (
                <RatingSummary summary={summary} />
              )}
              {TEXT_TYPES.includes(summary.questionType) && (
                <TextSummary textAnswers={summary.textAnswers ?? []} />
              )}
              {summary.questionType === NUMBER_TYPE && (
                <NumberSummary summary={summary} />
              )}
              {summary.questionType === DATE_TYPE && (
                <DateSummary textAnswers={summary.textAnswers ?? []} />
              )}
              {STATEMENT_TYPES.includes(summary.questionType) && (
                <StatementDisplay title={summary.questionTitle} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Choice Summary (Bar Chart) ────────────────────────────────────────────────

function ChoiceSummary({ choiceCounts }: { choiceCounts: Record<string, number> }) {
  const data = useMemo(() => {
    const entries = Object.entries(choiceCounts);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries
      .sort(([, a], [, b]) => b - a)
      .map(([label, count], index) => ({
        label: label.length > 25 ? label.slice(0, 25) + '...' : label,
        fullLabel: label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [choiceCounts]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    data.forEach((item, i) => {
      config[`item-${i}`] = { label: item.fullLabel, color: CHART_COLORS[i % CHART_COLORS.length] };
    });
    return config;
  }, [data]);

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-4">
      {/* Horizontal bar chart */}
      <ChartContainer config={chartConfig} className="h-[200px] w-full aspect-auto">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={100}
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            formatter={(value, _name, item) => {
              const payload = item.payload as { fullLabel?: string; percentage?: number };
              return [`${value} (${payload.percentage ?? 0}%)`, payload.fullLabel ?? "Option"];
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Detail list */}
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div
              className="size-3 rounded-sm shrink-0"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="text-sm flex-1 truncate">{item.fullLabel}</span>
            <span className="text-sm font-medium tabular-nums">{item.count}</span>
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {total > 0 ? Math.round((item.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rating / Opinion Scale Summary ────────────────────────────────────────────

function RatingSummary({ summary }: { summary: QuestionSummary }) {
  const average = summary.average ?? 0;
  const min = summary.min ?? 0;
  const max = summary.max ?? 0;
  const isRating = summary.questionType === 'rating';

  // Build distribution data
  const distributionData = useMemo(() => {
    const dataMap: Record<number, number> = {};
    const start = Math.floor(min);
    const end = Math.ceil(max);
    for (let i = start; i <= end; i++) {
      dataMap[i] = 0;
    }
    // Count values from textAnswers if available
    if (summary.textAnswers && summary.textAnswers.length > 0) {
      summary.textAnswers.forEach((v) => {
        const num = parseFloat(v);
        const rounded = Math.round(num);
        if (!isNaN(num) && rounded >= start && rounded <= end) {
          dataMap[rounded] = (dataMap[rounded] || 0) + 1;
        }
      });
    }
    return Object.entries(dataMap).map(([key, count]) => ({
      value: key,
      count,
      fill: CHART_COLORS[parseInt(key) % CHART_COLORS.length],
    }));
  }, [min, max, summary.textAnswers]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      count: { label: 'Responses', color: CHART_COLORS[0] },
    };
    return config;
  }, []);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="size-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Average</span>
          </div>
          <p className="text-xl font-bold">
            {isRating ? average.toFixed(1) : average.toFixed(2)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Minus className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Min</span>
          </div>
          <p className="text-xl font-bold">{min}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Maximize2 className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Max</span>
          </div>
          <p className="text-xl font-bold">{max}</p>
        </div>
      </div>

      {/* Star display for rating */}
      {isRating && (
        <div className="flex items-center justify-center gap-1 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`size-7 ${
                i < Math.round(average)
                  ? 'fill-warning text-warning'
                  : 'fill-muted text-muted'
              }`}
            />
          ))}
          <span className="ml-2 text-lg font-semibold">{average.toFixed(1)}</span>
        </div>
      )}

      {/* Distribution bar chart */}
      {distributionData.length > 1 && (
        <ChartContainer config={chartConfig} className="h-[120px] w-full aspect-auto">
          <BarChart data={distributionData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="value" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {distributionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[parseInt(entry.value) % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

// ─── Text Summary ──────────────────────────────────────────────────────────────

function TextSummary({ textAnswers }: { textAnswers: string[] }) {
  const wordFrequency = useMemo(() => {
    const freq: Record<string, number> = {};
    textAnswers.forEach((answer) => {
      const words = answer
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2);
      words.forEach((word) => {
        freq[word] = (freq[word] || 0) + 1;
      });
    });
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);
  }, [textAnswers]);

  const maxFreq = wordFrequency.length > 0 ? wordFrequency[0][1] : 1;

  return (
    <div className="space-y-4">
      {/* Word cloud-like display */}
      {wordFrequency.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center justify-center py-3">
          {wordFrequency.map(([word, count], index) => {
            const size = Math.max(12, Math.min(28, 12 + (count / maxFreq) * 16));
            const fontWeight = count === maxFreq ? 700 : 500;
            return (
              <motion.span
                key={word}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, delay: index * 0.02 }}
                className="inline-block cursor-default transition-colors hover:text-primary"
                style={{ fontSize: `${size}px`, fontWeight }}
              >
                {word}
              </motion.span>
            );
          })}
        </div>
      )}

      {/* Answer list */}
      <ScrollArea className="max-h-64">
        <div className="space-y-2">
          {textAnswers.map((answer, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{index + 1}</span>
              </div>
              <p className="text-sm break-words flex-1">{answer}</p>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Number Summary ────────────────────────────────────────────────────────────

function NumberSummary({ summary }: { summary: QuestionSummary }) {
  const average = summary.average ?? 0;
  const min = summary.min ?? 0;
  const max = summary.max ?? 0;

  const distributionData = useMemo(() => {
    if (!summary.textAnswers || summary.textAnswers.length === 0) return [];
    const values = summary.textAnswers.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
    if (values.length === 0) return [];

    // Create buckets
    const bucketSize = Math.max(1, Math.ceil((max - min) / 8));
    const buckets: Record<string, number> = {};
    for (let i = Math.floor(min); i <= Math.ceil(max); i += bucketSize) {
      const upper = i + bucketSize - 1;
      buckets[`${i}–${upper}`] = 0;
    }
    values.forEach((v) => {
      const bucketStart = Math.floor(v / bucketSize) * bucketSize;
      const upper = bucketStart + bucketSize - 1;
      const key = `${bucketStart}–${upper}`;
      if (buckets[key] !== undefined) {
        buckets[key]++;
      } else {
        // Add to nearest bucket
        const keys = Object.keys(buckets);
        if (keys.length > 0) {
          buckets[keys[keys.length - 1]]++;
        }
      }
    });

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }));
  }, [summary.textAnswers, min, max]);

  const chartConfig: ChartConfig = {
    count: { label: 'Responses', color: CHART_COLORS[3] },
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <span className="text-xs text-muted-foreground">Average</span>
          <p className="text-xl font-bold">{average.toFixed(2)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <span className="text-xs text-muted-foreground">Min</span>
          <p className="text-xl font-bold">{min}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <span className="text-xs text-muted-foreground">Max</span>
          <p className="text-xl font-bold">{max}</p>
        </div>
      </div>

      {/* Distribution */}
      {distributionData.length > 0 && (
        <ChartContainer config={chartConfig} className="h-[120px] w-full aspect-auto">
          <BarChart data={distributionData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="range" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

// ─── Date Summary ──────────────────────────────────────────────────────────────

function DateSummary({ textAnswers }: { textAnswers: string[] }) {
  const timelineData = useMemo(() => {
    const dateCounts: Record<string, number> = {};
    textAnswers.forEach((dateStr) => {
      try {
        const d = new Date(dateStr);
        const key = d.toISOString().split('T')[0];
        dateCounts[key] = (dateCounts[key] || 0) + 1;
      } catch {
        // skip invalid dates
      }
    });
    return Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [textAnswers]);

  const chartConfig: ChartConfig = {
    count: { label: 'Responses', color: CHART_COLORS[1] },
  };

  return (
    <div className="space-y-4">
      {timelineData.length > 0 ? (
        <>
          <ChartContainer config={chartConfig} className="h-[140px] w-full aspect-auto">
            <BarChart data={timelineData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>

          <ScrollArea className="max-h-48">
            <div className="space-y-1.5">
              {timelineData.map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <div className="size-2 rounded-full bg-primary shrink-0" />
                  <span className="flex-1">{item.date}</span>
                  <Badge variant="secondary" className="text-xs">
                    {item.count} {item.count === 1 ? 'response' : 'responses'}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No date answers yet</p>
      )}
    </div>
  );
}

// ─── Statement / Legal Display ─────────────────────────────────────────────────

function StatementDisplay({ title }: { title: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
      <div className="flex items-start gap-3">
        <Quote className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground italic">{title}</p>
      </div>
    </div>
  );
}
