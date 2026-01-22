import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  FlaskConical, 
  Play, 
  Square,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PentestStatus {
  configured: boolean;
  configuredViaEnv?: boolean;
  connected?: boolean;
  message?: string;
}

interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration?: number;
  error?: string;
}

interface TestRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  liveProgress?: {
    currentTest: string;
    currentFile: string;
  } | null;
}

interface TestsPanelProps {
  onBack: () => void;
}

export function TestsPanel({ onBack }: TestsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  const { data: testRuns, isLoading, refetch } = useQuery<TestRun[]>({
    queryKey: ['/api/v1/admin/test-runs'],
  });

  const { data: currentRun } = useQuery<TestRun | null>({
    queryKey: ['/api/v1/admin/test-runs/current'],
    refetchInterval: isRunning ? 1000 : false,
  });

  const { data: pentestStatus } = useQuery<PentestStatus>({
    queryKey: ['/api/v1/admin/pentest-tools/status'],
  });

  // Sync isRunning state with backend - check if any test is actually running
  useEffect(() => {
    if (testRuns && testRuns.length > 0) {
      const hasRunningTest = testRuns.some(run => run.status === 'running');
      setIsRunning(hasRunningTest);
    }
  }, [testRuns]);

  // Also check currentRun for faster updates - when test finishes, refresh the list
  useEffect(() => {
    if (currentRun === null && isRunning) {
      setIsRunning(false);
      // Delay to prevent race condition
      setTimeout(() => {
        refetch();
      }, 500);
    } else if (currentRun && currentRun.status === 'running') {
      setIsRunning(true);
    }
  }, [currentRun]);

  const runTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/test-runs');
      return response.json();
    },
    onSuccess: () => {
      setIsRunning(true);
      toast({ title: t('admin.tests.started'), description: t('admin.tests.startedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/test-runs'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.startError'), variant: "destructive" });
    },
  });

  const stopTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/test-runs/stop');
      return response.json();
    },
    onSuccess: () => {
      setIsRunning(false);
      toast({ title: t('admin.tests.stopped'), description: t('admin.tests.stoppedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/test-runs'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.stopError'), variant: "destructive" });
    },
  });

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: TestRun['status']) => {
    switch (status) {
      case 'running': return <Badge className="bg-blue-500">{t('admin.tests.running')}</Badge>;
      case 'completed': return <Badge className="bg-green-500">{t('admin.tests.completed')}</Badge>;
      case 'failed': return <Badge variant="destructive">{t('admin.tests.failed')}</Badge>;
    }
  };

  const calculateProgress = (run: TestRun) => {
    if (run.summary.total === 0) return 0;
    return ((run.summary.passed + run.summary.failed + run.summary.skipped) / run.summary.total) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-tests">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t('admin.tests.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.tests.description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-polly-orange border-polly-orange">
            <FlaskConical className="w-3 h-3 mr-1" />
            {t('admin.tests.automatedTests')}
          </Badge>
        </div>
      </div>

      {/* Test Controls */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            {t('admin.tests.runTests')}
          </CardTitle>
          <CardDescription>{t('admin.tests.runTestsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button
                onClick={() => runTestsMutation.mutate()}
                disabled={runTestsMutation.isPending}
                data-testid="button-run-tests"
              >
                {runTestsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {t('admin.tests.startTests')}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => stopTestsMutation.mutate()}
                disabled={stopTestsMutation.isPending}
                data-testid="button-stop-tests"
              >
                {stopTestsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 mr-2" />
                )}
                {t('admin.tests.stopTests')}
              </Button>
            )}
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-tests">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('common.refresh')}
            </Button>
          </div>

          {currentRun && currentRun.status === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('admin.tests.progress')}</span>
                <span>{Math.round(calculateProgress(currentRun))}%</span>
              </div>
              <Progress value={calculateProgress(currentRun)} />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="text-green-500">✓ {currentRun.summary.passed}</span>
                <span className="text-red-500">✗ {currentRun.summary.failed}</span>
                <span className="text-amber-500">○ {currentRun.summary.skipped}</span>
                <span>/ {currentRun.summary.total}</span>
              </div>
              {currentRun.liveProgress?.currentTest && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  <span className="truncate" title={currentRun.liveProgress.currentTest}>
                    {currentRun.liveProgress.currentTest}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test History */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle>{t('admin.tests.history')}</CardTitle>
          <CardDescription>{t('admin.tests.historyDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !testRuns || testRuns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.tests.noRuns')}</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {testRuns.map((run) => {
                const completedCount = run.summary.passed + run.summary.failed + run.summary.skipped;
                const progressPercent = run.summary.total > 0 ? (completedCount / run.summary.total) * 100 : 0;
                const liveTestName = run.liveProgress?.currentTest || '';
                const liveFileName = run.liveProgress?.currentFile?.replace('server/tests/', '') || '';
                
                return (
                <AccordionItem key={run.id} value={run.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4 gap-4">
                      <div className="flex items-center gap-3 shrink-0">
                        {getStatusBadge(run.status)}
                        <span className="text-sm text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString()}
                        </span>
                      </div>
                      
                      {run.status === 'running' && (
                        <div className="flex-1 mx-4 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />
                            <span className="text-xs text-muted-foreground truncate" title={liveTestName || liveFileName}>
                              {liveTestName 
                                ? liveTestName 
                                : (liveFileName || t('admin.tests.runningVitest'))}
                            </span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm shrink-0">
                        <span className="text-green-500">{run.summary.passed} passed</span>
                        <span className="text-red-500">{run.summary.failed} failed</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-4">
                      {run.results.map((result) => (
                        <div key={result.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="text-sm">{result.name}</span>
                          </div>
                          {result.duration && (
                            <span className="text-xs text-muted-foreground">
                              {result.duration}ms
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Pentest-Tools Integration */}
      {pentestStatus?.configured && (
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              {t('admin.tests.pentestTools.title')}
            </CardTitle>
            <CardDescription>{t('admin.tests.pentestTools.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={pentestStatus.connected ? "default" : "secondary"} className={pentestStatus.connected ? "bg-green-500" : ""}>
                  {pentestStatus.connected ? t('admin.tests.pentestTools.connected') : t('admin.tests.pentestTools.notConnected')}
                </Badge>
                {pentestStatus.configuredViaEnv && (
                  <Badge variant="outline">{t('admin.tests.pentestTools.configuredViaEnv')}</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open('/admin?panel=settings&settings=pentest', '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('admin.tests.pentestTools.openSettings')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
