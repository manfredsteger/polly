import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Eye,
  Target,
  ArrowLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Check,
  Sun,
  Moon
} from "lucide-react";
import { format } from "date-fns";
import type { CustomizationSettings } from "@shared/schema";

export function WCAGAccessibilityPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: customization, isLoading } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/admin/customization'],
  });
  
  const wcagSettings = customization?.wcag || { enforcementEnabled: false, enforceDefaultTheme: true };
  const lastAudit = 'lastAudit' in wcagSettings ? wcagSettings.lastAudit : undefined;
  
  const toggleEnforcementMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest('PUT', '/api/v1/admin/wcag/settings', { enforcementEnabled: enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/customization'] });
      toast({ title: t('admin.toasts.saved'), description: t('admin.wcag.settingsSaved') });
    },
    onError: () => {
      toast({ title: t('errors.generic'), variant: "destructive" });
    }
  });
  
  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/wcag/audit', {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      if (data.passed) {
        toast({ title: t('admin.wcag.auditPassed'), description: t('admin.wcag.allColorsMeetWCAG') });
      } else {
        toast({ title: t('admin.wcag.auditFailed'), description: t('admin.wcag.issuesFound', { count: data.issues.length }), variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: t('errors.generic'), variant: "destructive" });
    }
  });
  
  const applyCorrectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/wcag/apply-corrections', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/customization'] });
      toast({ title: t('admin.wcag.correctionsApplied'), description: t('admin.wcag.colorsUpdated') });
    },
    onError: () => {
      toast({ title: t('errors.generic'), variant: "destructive" });
    }
  });
  
  const getTokenLabel = (token: string) => {
    const labels: Record<string, string> = {
      '--primary': t('admin.wcag.primaryColor'),
      '--color-schedule': t('admin.wcag.scheduleColor'),
      '--color-survey': t('admin.wcag.surveyColor'),
      '--color-organization': t('admin.wcag.organizationColor'),
    };
    return labels[token] || token;
  };
  
  const lightIssues = lastAudit?.issues?.filter((i: any) => i.mode === 'light') || [];
  const darkIssues = lastAudit?.issues?.filter((i: any) => i.mode === 'dark') || [];
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  
  const renderIssueCard = (issue: any, idx: number) => (
    <div key={idx} className="p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{getTokenLabel(issue.token)}</span>
        <Badge variant="destructive">
          {t('admin.wcag.contrast')}: {issue.contrastRatio}:1
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span>{t('admin.wcag.current')}:</span>
          <div 
            className="w-6 h-6 rounded border" 
            style={{ backgroundColor: issue.originalValue }}
          />
          <code className="text-xs">{issue.originalValue}</code>
        </div>
        <ChevronRight className="w-4 h-4" />
        <div className="flex items-center gap-2">
          <span>{t('admin.wcag.suggested')}:</span>
          <div 
            className="w-6 h-6 rounded border" 
            style={{ backgroundColor: issue.suggestedValue }}
          />
          <code className="text-xs">{issue.suggestedValue}</code>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        {t('admin.wcag.requiredRatio')}: {issue.requiredRatio}:1
      </div>
    </div>
  );

  const renderModeSection = (
    mode: 'light' | 'dark',
    issues: any[],
    Icon: typeof Sun,
    label: string
  ) => {
    const hasIssues = issues.length > 0;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h4 className="font-semibold text-base">{label}</h4>
          {hasIssues ? (
            <Badge variant="destructive" className="ml-auto">
              {issues.length} {issues.length === 1 ? 'Issue' : 'Issues'}
            </Badge>
          ) : (
            <div className="flex items-center gap-1 ml-auto text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">{t('admin.wcag.passesInMode', { mode: label })}</span>
            </div>
          )}
        </div>
        {hasIssues && (
          <div className="space-y-2 pl-7">
            {issues.map((issue: any, idx: number) => renderIssueCard(issue, idx))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-wcag-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{t('admin.wcag.title')}</h2>
            <p className="text-muted-foreground">{t('admin.wcag.subtitle')}</p>
          </div>
        </div>
      </div>
      
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {t('admin.wcag.enforcementTitle')}
          </CardTitle>
          <CardDescription>{t('admin.wcag.enforcementDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <Label htmlFor="wcag-enforcement" className="text-base font-medium">
                {t('admin.wcag.autoCorrection')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('admin.wcag.autoCorrectionDescription')}
              </p>
            </div>
            <Switch
              id="wcag-enforcement"
              checked={wcagSettings.enforcementEnabled}
              onCheckedChange={(v) => toggleEnforcementMutation.mutate(v)}
              disabled={toggleEnforcementMutation.isPending}
              data-testid="switch-wcag-enforcement"
            />
          </div>
          
          {wcagSettings.enforcementEnabled && (
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                {t('admin.wcag.enforcementActiveNote')}
              </AlertDescription>
            </Alert>
          )}
          
          {!wcagSettings.enforcementEnabled && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {t('admin.wcag.enforcementInactiveNote')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            {t('admin.wcag.auditTitle')}
          </CardTitle>
          <CardDescription>{t('admin.wcag.auditDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => runAuditMutation.mutate()}
              disabled={runAuditMutation.isPending}
              data-testid="button-run-wcag-audit"
            >
              {runAuditMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {t('admin.wcag.runAudit')}
            </Button>
            
            {lastAudit && (
              <span className="text-sm text-muted-foreground">
                {t('admin.wcag.lastAudit')}: {format(new Date(lastAudit.runAt), 'dd.MM.yyyy HH:mm')}
              </span>
            )}
          </div>
          
          {lastAudit && (
            <div className="space-y-4 pt-4 border-t">
              {lastAudit.passed ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">{t('admin.wcag.allColorsMeetWCAG')}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">{t('admin.wcag.issuesFound', { count: lastAudit.issues.length })}</span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {t('admin.wcag.perModeCorrections')}
                  </p>
                  
                  <div className="space-y-6">
                    {renderModeSection('light', lightIssues, Sun, t('admin.wcag.lightMode'))}
                    {renderModeSection('dark', darkIssues, Moon, t('admin.wcag.darkMode'))}
                  </div>
                  
                  <Button
                    variant="default"
                    onClick={() => applyCorrectMutation.mutate()}
                    disabled={applyCorrectMutation.isPending}
                    data-testid="button-apply-wcag-corrections"
                  >
                    {applyCorrectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.wcag.applyCorrections')}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
