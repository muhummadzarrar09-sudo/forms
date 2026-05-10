'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, subDays, startOfDay } from 'date-fns';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
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

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DisplayResponse {
  id: string;
  number: number;
  submittedAt: string;
  timeTaken: number | null;
  answers: {
    questionId: string;
    questionTitle: string;
    questionType: string;
    value: string;
  }[];
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function ResponsesViewer() {
  const { selectedFormId, openBuilder, openFiller, currentForm, setCurrentForm } = useFormStore();

  // Data state
  const [summary, setSummary] = useState<FormSummary | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
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
          setResponses(responsesData);
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

  // ─── Process responses for display ─────────────────────────────────────────

  const displayResponses: DisplayResponse[] = useMemo(() => {
    return responses
      .filter((r) => {
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
          answers: r.answers.map((a) => ({
            questionId: a.questionId,
            questionTitle: a.question?.title || 'Unknown Question',
            questionType: a.question?.type || 'short_text',
            value: a.value,
          })),
        };
      });
  }, [responses, dateFrom, dateTo, searchQuery]);

  // ─── CSV Export ────────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(() => {
    if (responses.length === 0) {
      toast({
        title: 'No responses to export',
        description: 'There are no responses to download.',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Response #', 'Submitted At', 'Time Taken', ...questions.map((q) => q.title)];
    const rows = displayResponses.map((r) => {
      const timeTakenStr = r.timeTaken !== null ? formatDuration(r.timeTaken) : 'N/A';
      const answerMap: Record<string, string> = {};
      r.answers.forEach((a) => {
        answerMap[a.questionId] = a.value;
      });
      return [
        r.number.toString(),
        new Date(r.submittedAt).toLocaleString(),
        timeTakenStr,
        ...questions.map((q) => {
          const val = answerMap[q.id] || '';
          // Escape CSV values
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentForm?.title || 'form'}-responses.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export successful',
      description: `${displayResponses.length} responses downloaded as CSV.`,
    });
  }, [responses, displayResponses, questions, currentForm]);

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
            <Button variant="ghost" size="icon" onClick={openBuilder} className="shrink-0">
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
              <Button variant="outline" onClick={openBuilder} className="gap-2">
                <ArrowLeft className="size-4" />
                Back to Builder
              </Button>
              <Button onClick={() => openFiller(selectedFormId!)} className="gap-2">
                <ExternalLink className="size-4" />
                Preview Form
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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={openBuilder} className="shrink-0">
                <ArrowLeft className="size-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold truncate">{currentForm?.title || 'Form'}</h1>
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
        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Responses</p>
                    <p className="text-3xl font-bold tabular-nums">{totalResponses}</p>
                  </div>
                  <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="size-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Completion Rate</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-3xl font-bold tabular-nums">{completionRate}</p>
                      <span className="text-lg text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="size-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Avg. Time</p>
                    <p className="text-3xl font-bold tabular-nums">{formatDuration(averageTime)}</p>
                  </div>
                  <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Clock className="size-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Response Trend Chart */}
        {responseTrendData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  Responses over time
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={responseChartConfig} className="h-[200px] w-full">
                  <BarChart data={responseTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
                      fill="var(--color-responses)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ChartContainer>
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
            </TabsList>

            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto sm:justify-end">
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
              </div>
            )}
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
      <Card className="overflow-hidden">
        {/* Collapsed header */}
        <button
          onClick={onToggle}
          className="w-full text-left p-4 hover:bg-muted/30 transition-colors flex items-center gap-4"
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
