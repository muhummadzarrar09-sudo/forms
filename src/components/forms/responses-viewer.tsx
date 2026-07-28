'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormStore } from '@/store/form-store';
import type { FormResponse, FormSummary, QuestionSummary, FormQuestion, FormAnswer } from '@/types/form';
import { formatDuration } from '@/lib/form-helpers';
import { QuestionSummaryCard } from '@/components/forms/question-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  ArrowLeft,
  Download,
  Search,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  FileText,
  Inbox,
  CalendarIcon,
  Filter,
  BarChart3,
  List,
  ExternalLink,
  MessageSquare,
  Trash2,
  FileDown,
  TrendingDown,
  AlertTriangle,
  Trophy,
  FilterX,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, subDays, startOfDay } from 'date-fns';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Line, LineChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const responseChartConfig = {
  responses: {
    label: 'Responses',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const lineChartConfig = {
  responses: {
    label: 'Responses',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

// ─── Animated counter hook ────────────────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    if (target === prevTargetRef.current) return;
    const start = prevTargetRef.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let rafId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    prevTargetRef.current = target;

    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return count;
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DisplayResponse {
  id: string;
  number: number;
  submittedAt: string;
  timeTaken: number | null;
  score: number;
  isPartial: boolean;
  answers: {
    questionId: string;
    questionTitle: string;
    questionType: string;
    value: string;
    score: number;
  }[];
}

// ─── Main Component ─────────────────────────────────────────────────────────────

function dateFilterParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ResponsesViewer() {
  const { selectedFormId, openBuilder, openFiller, currentForm, setCurrentForm, openResponses } = useFormStore();

  // Data state
  const [summary, setSummary] = useState<FormSummary | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [nextResponseCursor, setNextResponseCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showPartial, setShowPartial] = useState(true); // filter for partial responses

  // Fetch form data + summary + responses
  useEffect(() => {
    if (!selectedFormId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [formRes, summaryRes, responsesRes] = await Promise.all([
          fetch(`/api/forms/${selectedFormId}`),
          fetch(`/api/forms/${selectedFormId}/responses/summary`),
          fetch(`/api/forms/${selectedFormId}/responses`),
        ]);

        if (formRes.ok) {
          const formData = await formRes.json();
          setCurrentForm(formData);
          setQuestions(formData.questions || []);
        }

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }

        if (responsesRes.ok) {
          const responsesData = await responsesRes.json();
          setResponses(responsesData.responses || []);
          setNextResponseCursor(responsesData.nextCursor || null);
        }
      } catch {
        toast({
          title: 'Error loading responses',
          description: 'Could not fetch response data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedFormId, setCurrentForm]);

  // Search and date filters must query the paginated API rather than filtering
  // only whichever response page happens to be in browser memory.
  useEffect(() => {
    if (!selectedFormId) return;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        if (dateFrom) params.set('startDate', dateFilterParam(dateFrom));
        if (dateTo) params.set('endDate', dateFilterParam(dateTo));
        const response = await fetch(`/api/forms/${encodeURIComponent(selectedFormId)}/responses?${params}`);
        if (!response.ok) throw new Error('Response filter request failed');
        const page = await response.json() as { responses?: FormResponse[]; nextCursor?: string | null };
        setResponses(page.responses || []);
        setNextResponseCursor(page.nextCursor || null);
      } catch {
        toast({ title: 'Could not filter responses', description: 'Please try again.', variant: 'destructive' });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [selectedFormId, searchQuery, dateFrom, dateTo]);

  const loadMoreResponses = useCallback(async () => {
    if (!selectedFormId || !nextResponseCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: '50', cursor: nextResponseCursor });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (dateFrom) params.set('startDate', dateFilterParam(dateFrom));
      if (dateTo) params.set('endDate', dateFilterParam(dateTo));
      const response = await fetch(`/api/forms/${encodeURIComponent(selectedFormId)}/responses?${params}`);
      if (!response.ok) throw new Error('Response page request failed');
      const page = await response.json() as { responses?: FormResponse[]; nextCursor?: string | null };
      setResponses((current) => [...current, ...(page.responses || [])]);
      setNextResponseCursor(page.nextCursor || null);
    } catch {
      toast({
        title: 'Could not load more responses',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedFormId, nextResponseCursor, isLoadingMore, searchQuery, dateFrom, dateTo]);

  // ─── Process responses for display ─────────────────────────────────────────

  const displayResponses: DisplayResponse[] = useMemo(() => {
    return responses
      .filter((r) => {
        // Partial response filter
        if (!showPartial && r.isPartial) return false;

        // Date range filter
        if (dateFrom || dateTo) {
          const submittedDate = r.completedAt ? new Date(r.completedAt) : new Date(r.startedAt);
          if (dateFrom && submittedDate < dateFrom) return false;
          if (dateTo) {
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            if (submittedDate > endOfDay) return false;
          }
        }

        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const hasMatch = r.answers.some(
            (a) =>
              a.value.toLowerCase().includes(query) ||
              (a.question?.title?.toLowerCase() || '').includes(query)
          );
          if (!hasMatch) return false;
        }

        return true;
      })
      .map((r, index) => {
        const timeTaken = r.completedAt
          ? (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000
          : null;

        return {
          id: r.id,
          number: responses.length - index,
          submittedAt: r.completedAt || r.startedAt,
          timeTaken,
          score: r.score || 0,
          isPartial: r.isPartial ?? false,
          answers: r.answers.map((a) => ({
            questionId: a.questionId,
            questionTitle: a.question?.title || 'Unknown Question',
            questionType: a.question?.type || 'short_text',
            value: a.value,
            score: a.score || 0,
          })),
        };
      });
  }, [responses, dateFrom, dateTo, searchQuery, showPartial]);

  // ─── CSV Export ────────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(async () => {
    if (!selectedFormId) return;
    try {
      // Export is streamed server-side, so it includes every response rather
      // than only the currently loaded cursor page.
      const response = await fetch(`/api/forms/${encodeURIComponent(selectedFormId)}/responses/export`);
      if (!response.ok) throw new Error('Export request failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentForm?.title || 'form'}-responses.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Export successful', description: 'All responses were downloaded as CSV.' });
    } catch {
      toast({ title: 'Export failed', description: 'Could not create the response export. Please try again.', variant: 'destructive' });
    }
  }, [selectedFormId, currentForm]);

  // ─── Bulk Delete All Responses ─────────────────────────────────────────────
  const handleClearAllResponses = useCallback(async () => {
    if (!selectedFormId) return;
    setIsClearingAll(true);
    try {
      const res = await fetch(`/api/forms/${selectedFormId}/responses`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setResponses([]);
        setSummary(null);
        toast({
          title: 'All responses deleted',
          description: `${data.deletedCount} response${data.deletedCount !== 1 ? 's' : ''} permanently deleted.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to delete responses',
          description: 'Could not delete all responses. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Failed to delete responses',
        description: 'Could not delete all responses. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsClearingAll(false);
      setShowClearAllDialog(false);
    }
  }, [selectedFormId]);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalResponses = summary?.totalResponses ?? 0;
  const completionRate = summary?.completionRate ?? 0;
  const averageTime = summary?.averageTime ?? 0;

  // Average score from responses
  const averageScore = useMemo(() => {
    const scoredResponses = responses.filter((r) => (r.score || 0) > 0);
    if (scoredResponses.length === 0) return 0;
    const total = scoredResponses.reduce((sum, r) => sum + (r.score || 0), 0);
    return Math.round((total / scoredResponses.length) * 10) / 10;
  }, [responses]);

  const hasScoring = useMemo(() => {
    return responses.some((r) => (r.score || 0) > 0);
  }, [responses]);

  // Animated stats
  const animatedTotalResponses = useAnimatedCounter(totalResponses);
  const animatedCompletionRate = useAnimatedCounter(completionRate);
  const animatedAverageTime = useAnimatedCounter(Math.round(averageTime));

  // ─── Response trend data ───────────────────────────────────────────────────
  const responseTrendData = useMemo(() => {
    if (responses.length === 0) return [];

    // Get date range: last 30 days or from first response
    const now = new Date();
    const firstResponseDate = responses.reduce((earliest, r) => {
      const d = new Date(r.completedAt || r.startedAt);
      return d < earliest ? d : earliest;
    }, now);
    const startDate = startOfDay(
      firstResponseDate > subDays(now, 30) ? firstResponseDate : subDays(now, 30)
    );

    // Build a map of date -> count
    const dateCounts: Record<string, number> = {};
    for (let d = new Date(startDate); d <= now; d = new Date(d.getTime() + 86400000)) {
      const key = format(d, 'yyyy-MM-dd');
      dateCounts[key] = 0;
    }

    responses.forEach((r) => {
      const date = startOfDay(new Date(r.completedAt || r.startedAt));
      const key = format(date, 'yyyy-MM-dd');
      if (key in dateCounts) {
        dateCounts[key]++;
      }
    });

    return Object.entries(dateCounts).map(([date, count]) => ({
      date,
      label: format(new Date(date), 'MMM d'),
      responses: count,
    }));
  }, [responses]);

  // ─── Drop-off Analysis ──────────────────────────────────────────────────
  const dropOffData = useMemo(() => {
    if (!questions.length || !responses.length) return [];
    const sortedQs = [...questions].sort((a, b) => a.order - b.order);
    const totalResponses = responses.length;

    return sortedQs.map((q, index) => {
      const answersForQ = responses.filter((r) =>
        r.answers.some((a) => a.questionId === q.id && a.value.trim() !== '')
      );
      const answerCount = answersForQ.length;
      const answerRate = totalResponses > 0 ? (answerCount / totalResponses) * 100 : 0;
      const dropOffRate = 100 - answerRate;

      // Calculate drop-off from previous question
      let dropFromPrev = 0;
      if (index > 0) {
        const prevQ = sortedQs[index - 1];
        const prevAnswers = responses.filter((r) =>
          r.answers.some((a) => a.questionId === prevQ.id && a.value.trim() !== '')
        );
        dropFromPrev = prevAnswers.length > 0 ? ((prevAnswers.length - answerCount) / prevAnswers.length) * 100 : 0;
      } else {
        dropFromPrev = totalResponses > 0 ? ((totalResponses - answerCount) / totalResponses) * 100 : 0;
      }

      return {
        questionId: q.id,
        questionTitle: q.title.length > 30 ? q.title.slice(0, 30) + '…' : q.title,
        answerCount,
        answerRate: Math.round(answerRate),
        dropOffRate: Math.round(dropOffRate),
        dropFromPrev: Math.round(Math.max(0, dropFromPrev)),
        questionIndex: index + 1,
      };
    });
  }, [questions, responses]);

  // ─── Loading State ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-5 w-40" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-10 w-64" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────────────────

  if (totalResponses === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => openBuilder(selectedFormId!)} className="shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-lg font-semibold truncate">{currentForm?.title || 'Form'}</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="relative inline-block">
              <div className="absolute -inset-4 rounded-full bg-primary/5 animate-pulse" />
              <div className="relative size-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
                <Inbox className="size-10 text-primary/60" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">No responses yet</h2>
            <p className="text-muted-foreground max-w-md">
              Share your form to start collecting responses. Once people submit their answers, you&apos;ll see analytics and individual responses here.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => openBuilder(selectedFormId!)} className="gap-2">
                <ArrowLeft className="size-4" />
                Back to Builder
              </Button>
              <Button onClick={() => openFiller(selectedFormId!)} className="gap-2">
                <ExternalLink className="size-4" />
                Preview Form
              </Button>
            </div>
            {/* Share CTA */}
            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 max-w-sm">
              <p className="text-sm font-medium mb-2">Share your form to collect responses</p>
              <p className="text-xs text-muted-foreground mb-3">
                Copy the share link and send it to your audience to start gathering data.
              </p>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  const url = `${window.location.origin}?form=${selectedFormId}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: 'Link copied!', description: 'Share link has been copied to your clipboard.' });
                }}
              >
                <ExternalLink className="size-3.5" />
                Copy Share Link
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with form title and colored accent */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => openBuilder(selectedFormId!)} className="shrink-0">
                <ArrowLeft className="size-4" />
              </Button>
              {/* Colored accent dot + form title */}
              <div
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: currentForm?.backgroundColor || 'hsl(var(--primary))' }}
              />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold truncate">{currentForm?.title || 'Form'}</h1>
                <p className="text-[10px] text-muted-foreground">Response Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openFiller(selectedFormId!)}
                className="gap-1.5 hidden sm:flex"
              >
                <ExternalLink className="size-3.5" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-1.5"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast({ title: 'Coming soon', description: 'PDF export will be available in a future update.' })}
                className="gap-1.5"
              >
                <FileDown className="size-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearAllDialog(true)}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Clear all</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats cards with completion rate as circular indicator */}
        <div className={`grid grid-cols-1 ${hasScoring ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Responses</p>
                    <p className="text-3xl font-bold tabular-nums">{animatedTotalResponses}</p>
                  </div>
                  <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="size-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
            <Card className="overflow-hidden bg-gradient-to-br from-emerald-500/5 to-transparent">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Completion Rate</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-3xl font-bold tabular-nums">{animatedCompletionRate}</p>
                      <span className="text-lg text-muted-foreground">%</span>
                    </div>
                  </div>
                  {/* Circular progress indicator */}
                  <div className="relative size-14">
                    <svg className="size-14 -rotate-90" viewBox="0 0 56 56">
                      <circle
                        cx="28"
                        cy="28"
                        r="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-emerald-500/10"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${(completionRate / 100) * 138.23} 138.23`}
                        className="text-emerald-500"
                        style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="overflow-hidden bg-gradient-to-br from-amber-500/5 to-transparent">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Avg. Time</p>
                    <p className="text-3xl font-bold tabular-nums">{formatDuration(animatedAverageTime)}</p>
                  </div>
                  <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Clock className="size-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Avg Score card - only shown when scoring is enabled */}
          {hasScoring && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
              <Card className="overflow-hidden bg-gradient-to-br from-violet-500/5 to-transparent">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Avg. Score</p>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-3xl font-bold tabular-nums">{averageScore}</p>
                        <span className="text-lg text-muted-foreground">pts</span>
                      </div>
                    </div>
                    <div className="size-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                      <BarChart3 className="size-5 text-violet-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Response Trend Chart */}
        {responseTrendData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  Responses over time
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={responseChartConfig} className="h-[200px] w-full">
                  <BarChart data={responseTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradientFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickMargin={4}
                      interval={Math.max(0, Math.floor(responseTrendData.length / 8) - 1)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      allowDecimals={false}
                      tickMargin={4}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      labelFormatter={(label) => label}
                    />
                    <Bar
                      dataKey="responses"
                      fill="url(#barGradientFill)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Responses Line Chart */}
        {responseTrendData.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  Daily Response Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={lineChartConfig} className="h-[180px] w-full">
                  <LineChart data={responseTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickMargin={4}
                      interval={Math.max(0, Math.floor(responseTrendData.length / 8) - 1)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      allowDecimals={false}
                      tickMargin={4}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      labelFormatter={(label) => label}
                    />
                    <Line
                      type="monotone"
                      dataKey="responses"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                      activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Drop-off Analysis */}
        {dropOffData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="size-4 text-muted-foreground" />
                  Drop-off Analysis
                </CardTitle>
                <p className="text-xs text-muted-foreground font-normal">
                  See which questions cause respondents to abandon the form
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dropOffData
                    .filter((d) => d.dropFromPrev > 0)
                    .sort((a, b) => b.dropFromPrev - a.dropFromPrev)
                    .map((d) => (
                      <div key={d.questionId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="size-5 rounded text-[10px] font-bold flex items-center justify-center bg-muted text-muted-foreground shrink-0">
                            {d.questionIndex}
                          </span>
                          <span className="text-sm truncate">{d.questionTitle}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-20">
                            <div className="flex items-center gap-1">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-amber-500"
                                  style={{ width: `${d.answerRate}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                              {d.answerRate}% answer rate
                            </p>
                          </div>
                          <Badge
                            variant={d.dropFromPrev > 20 ? 'destructive' : 'outline'}
                            className="text-[10px] shrink-0 gap-1"
                          >
                            {d.dropFromPrev > 20 && <AlertTriangle className="size-2.5" />}
                            -{d.dropFromPrev}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  {dropOffData.filter((d) => d.dropFromPrev > 0).length === 0 && (
                    <div className="py-4 text-center">
                      <p className="text-sm text-muted-foreground">No significant drop-off detected</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Great job! Your form has a smooth flow.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="summary" className="gap-1.5">
                <BarChart3 className="size-3.5" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="individual" className="gap-1.5">
                <List className="size-3.5" />
                Individual
              </TabsTrigger>
              <TabsTrigger value="funnel" className="gap-1.5">
                <TrendingDown className="size-3.5" />
                Funnel
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto sm:justify-end">
              {/* Partial response filter */}
              <Button
                variant={showPartial ? 'outline' : 'default'}
                size="sm"
                className="h-8 text-xs gap-1.5 shrink-0"
                onClick={() => setShowPartial(!showPartial)}
              >
                <Filter className="size-3.5" />
                {showPartial ? 'All' : 'Complete only'}
              </Button>

              {/* Search */}
              <div className="relative flex-1 sm:flex-initial sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search responses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* Date range filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs shrink-0">
                    <CalendarIcon className="size-3.5" />
                    <span className="hidden sm:inline">
                      {dateFrom || dateTo
                        ? `${dateFrom ? format(dateFrom, 'MMM d') : '...'} – ${dateTo ? format(dateTo, 'MMM d') : '...'}`
                        : 'Date range'}
                    </span>
                    <span className="sm:hidden">Filter</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">From</p>
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">To</p>
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setDateFrom(undefined);
                          setDateTo(undefined);
                        }}
                      >
                        <FilterX className="size-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-0">
            <div className="space-y-4">
              {(summary?.questionSummaries ?? []).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground">No question summaries available</p>
                  </CardContent>
                </Card>
              ) : (
                (summary?.questionSummaries ?? []).map((qs, index) => (
                  <QuestionSummaryCard
                    key={qs.questionId}
                    summary={qs}
                    questionIndex={index}
                    totalQuestions={summary?.questionSummaries?.length ?? 0}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* Individual Tab */}
          <TabsContent value="individual" className="mt-0">
            {displayResponses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {searchQuery || dateFrom || dateTo
                      ? 'No responses match your filters'
                      : 'No responses yet'}
                  </p>
                  {(searchQuery || dateFrom || dateTo) && (
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => {
                        setSearchQuery('');
                        setDateFrom(undefined);
                        setDateTo(undefined);
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {displayResponses.length} of {responses.length} responses
                  </p>
                </div>

                <AnimatePresence mode="popLayout">
                  {displayResponses.map((response) => (
                    <ResponseCard
                      key={response.id}
                      response={response}
                      isExpanded={expandedResponseId === response.id}
                      onToggle={() =>
                        setExpandedResponseId((prev) =>
                          prev === response.id ? null : response.id
                        )
                      }
                      questions={questions}
                      formId={selectedFormId!}
                      onDelete={(responseId) => {
                        setResponses((prev) => prev.filter((r) => r.id !== responseId));
                        if (expandedResponseId === responseId) {
                          setExpandedResponseId(null);
                        }
                      }}
                    />
                  ))}
                </AnimatePresence>
                {nextResponseCursor && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={loadMoreResponses} disabled={isLoadingMore}>
                      {isLoadingMore ? 'Loading…' : 'Load more responses'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="mt-0">
            <FunnelTab questions={questions} responses={responses} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Forms &mdash; Response Analytics
          </p>
        </div>
      </footer>

      {/* Clear All Responses Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all responses?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all {responses.length} response{responses.length !== 1 ? 's' : ''} and their answers from this form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllResponses}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isClearingAll}
            >
              {isClearingAll ? 'Deleting...' : 'Delete all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Individual Response Card ──────────────────────────────────────────────────

interface ResponseCardProps {
  response: DisplayResponse;
  isExpanded: boolean;
  onToggle: () => void;
  questions: FormQuestion[];
  formId: string;
  onDelete: (responseId: string) => void;
}

function ResponseCard({ response, isExpanded, onToggle, questions, formId, onDelete }: ResponseCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/forms/${formId}/responses/${response.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDelete(response.id);
        toast({
          title: 'Response deleted',
          description: `Response #${response.number} has been permanently deleted.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to delete',
          description: 'Could not delete the response. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Failed to delete',
        description: 'Could not delete the response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden relative transition-all duration-200 hover:shadow-md">
        {/* Left color accent border */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/40 rounded-r-full"
        />
        {/* Collapsed header */}
        <button
          onClick={onToggle}
          className="w-full text-left p-4 hover:bg-muted/30 transition-colors flex items-center gap-4 pl-5"
        >
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{response.number}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">
                Response #{response.number}
              </p>
              {response.timeTaken !== null && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <Clock className="size-2.5" />
                  {formatDuration(response.timeTaken)}
                </Badge>
              )}
              {response.isPartial && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950">
                  Partial
                </Badge>
              )}
              {response.score > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-violet-600 border-violet-200 bg-violet-50">
                  <BarChart3 className="size-2.5" />
                  {response.score} pts
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(response.submittedAt), 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
          <div className="shrink-0">
            {isExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <Separator />
              <div className="p-4 space-y-4">
                {response.answers.map((answer, index) => {
                  const question = questions.find((q) => q.id === answer.questionId);
                  return (
                    <div key={answer.questionId} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {index + 1}.
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {answer.questionTitle}
                        </p>
                        {answer.score > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 text-violet-600 border-violet-200 bg-violet-50">
                            +{answer.score}
                          </Badge>
                        )}
                      </div>
                      <div className="pl-5">
                        {answer.value ? (
                          <p className="text-sm font-medium">{answer.value}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground/60 italic">No answer</p>
                        )}
                      </div>
                      {index < response.answers.length - 1 && (
                        <Separator className="mt-3 opacity-50" />
                      )}
                    </div>
                  );
                })}

                {/* Delete response button */}
                <div className="flex justify-end pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                    disabled={isDeleting}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    {isDeleting ? 'Deleting...' : 'Delete Response'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Response #{response.number}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this response and all of its answers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </motion.div>
  );
}

// ─── Funnel Tab ────────────────────────────────────────────────────────────

function FunnelTab({ questions, responses }: { questions: FormQuestion[]; responses: FormResponse[] }) {
  const funnelData = useMemo(() => {
    if (!questions.length || !responses.length) return [];
    const sortedQs = [...questions].sort((a, b) => a.order - b.order);
    const total = responses.length;

    return sortedQs.map((q, index) => {
      const answersForQ = responses.filter((r) =>
        r.answers.some((a) => a.questionId === q.id && a.value.trim() !== '')
      );
      const answerCount = answersForQ.length;
      const completionRate = total > 0 ? (answerCount / total) * 100 : 0;

      let dropFromPrev = 0;
      if (index > 0) {
        const prevQ = sortedQs[index - 1];
        const prevAnswers = responses.filter((r) =>
          r.answers.some((a) => a.questionId === prevQ.id && a.value.trim() !== '')
        );
        dropFromPrev = prevAnswers.length > 0 ? ((prevAnswers.length - answerCount) / prevAnswers.length) * 100 : 0;
      } else {
        dropFromPrev = total > 0 ? ((total - answerCount) / total) * 100 : 0;
      }

      return {
        questionId: q.id,
        questionTitle: q.title,
        answerCount,
        viewedCount: total,
        completionRate: Math.round(completionRate),
        dropFromPrev: Math.round(Math.max(0, dropFromPrev)),
        questionIndex: index + 1,
      };
    });
  }, [questions, responses]);

  if (funnelData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <TrendingDown className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No funnel data available</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Funnel data will appear once you have responses.</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = funnelData[0]?.viewedCount || 1;

  return (
    <div className="space-y-4">
      {/* Visual funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="size-4 text-muted-foreground" />
            Response Funnel
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            See how many respondents reached and answered each question
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {funnelData.map((d) => {
              const widthPercent = maxCount > 0 ? (d.answerCount / maxCount) * 100 : 0;
              const colorClass =
                d.completionRate >= 80 ? 'bg-emerald-500' :
                d.completionRate >= 50 ? 'bg-amber-500' :
                'bg-red-500';
              const textColor =
                d.completionRate >= 80 ? 'text-emerald-700' :
                d.completionRate >= 50 ? 'text-amber-700' :
                'text-red-700';

              return (
                <div key={d.questionId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="size-5 rounded text-[10px] font-bold flex items-center justify-center bg-muted text-muted-foreground shrink-0">
                        {d.questionIndex}
                      </span>
                      <span className="text-sm truncate">{d.questionTitle}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold ${textColor}`}>
                        {d.answerCount}/{d.viewedCount}
                      </span>
                      {d.dropFromPrev > 0 && (
                        <Badge
                          variant={d.dropFromPrev > 20 ? 'destructive' : 'outline'}
                          className="text-[10px] shrink-0 gap-0.5"
                        >
                          {d.dropFromPrev > 20 && <AlertTriangle className="size-2.5" />}
                          -{d.dropFromPrev}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Bar */}
                  <div className="relative h-8 rounded-md bg-muted/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPercent}%` }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: d.questionIndex * 0.05 }}
                      className={`h-full rounded-md ${colorClass} flex items-center justify-end pr-2`}
                    >
                      <span className="text-[10px] font-bold text-white drop-shadow-sm">
                        {d.completionRate}%
                      </span>
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="size-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{funnelData.filter((d) => d.completionRate >= 80).length}</p>
            <p className="text-[10px] text-muted-foreground">High completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="size-5 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{funnelData.filter((d) => d.completionRate >= 50 && d.completionRate < 80).length}</p>
            <p className="text-[10px] text-muted-foreground">Moderate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="size-5 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{funnelData.filter((d) => d.completionRate < 50).length}</p>
            <p className="text-[10px] text-muted-foreground">High drop-off</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
