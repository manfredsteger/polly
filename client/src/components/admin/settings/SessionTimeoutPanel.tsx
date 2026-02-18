import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Timer,
  Clock,
  AlertTriangle,
  Info,
  ArrowLeft,
  Loader2
} from "lucide-react";

interface SessionTimeoutSettings {
  enabled: boolean;
  adminTimeoutMinutes: number;
  managerTimeoutMinutes: number;
  userTimeoutMinutes: number;
  showWarningMinutes: number;
}

export function SessionTimeoutPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<SessionTimeoutSettings>({
    enabled: false,
    adminTimeoutMinutes: 480,
    managerTimeoutMinutes: 240,
    userTimeoutMinutes: 60,
    showWarningMinutes: 5,
  });

  const { data: timeoutData, isLoading } = useQuery<SessionTimeoutSettings>({
    queryKey: ['/api/v1/admin/session-timeout'],
  });

  useEffect(() => {
    if (timeoutData) {
      setSettings(timeoutData);
    }
  }, [timeoutData]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: SessionTimeoutSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/session-timeout', newSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.sessionTimeout.saved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/session-timeout'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}${t('common.hoursShort')} ${mins}${t('common.minutesShort')}` : t('common.hoursWithValue', { count: hours });
    }
    return t('common.minutesWithValue', { count: minutes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('admin.roles.backToSettings')}
        </Button>
        <span className="font-medium text-foreground">{t('admin.sessionTimeout.breadcrumb')}</span>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.sessionTimeout.title')}</h2>
          <p className="text-muted-foreground">{t('admin.sessionTimeout.description')}</p>
        </div>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              {t('admin.sessionTimeout.breadcrumb')}
            </CardTitle>
            <CardDescription>
              {t('admin.sessionTimeout.usersAutoLoggedOut')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.sessionTimeout.timeoutEnabled')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.sessionTimeout.enableAutoLogout')}</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
                data-testid="switch-session-timeout-enabled"
              />
            </div>
            
            {!settings.enabled && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                {t('admin.sessionTimeout.timeoutDisabledNote')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('admin.sessionTimeout.roleBasedTimeouts')}
            </CardTitle>
            <CardDescription>
              {t('admin.sessionTimeout.roleBasedDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="polly-badge-admin">Admin</Badge>
                  <span className="text-sm text-muted-foreground">{t('admin.sessionTimeout.longestSessionForAdmins')}</span>
                </div>
                <span className="text-sm font-medium">{formatDuration(settings.adminTimeoutMinutes)}</span>
              </div>
              <Input
                type="range"
                min={30}
                max={720}
                step={30}
                value={settings.adminTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, adminTimeoutMinutes: parseInt(e.target.value) })}
                disabled={!settings.enabled}
                className="w-full"
                data-testid="slider-admin-timeout"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>30 Min</span>
                <span>12 {t('admin.sessionTimeout.hours')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="polly-badge-manager">Manager</Badge>
                  <span className="text-sm text-muted-foreground">{t('admin.sessionTimeout.mediumSessionForManagers')}</span>
                </div>
                <span className="text-sm font-medium">{formatDuration(settings.managerTimeoutMinutes)}</span>
              </div>
              <Input
                type="range"
                min={15}
                max={480}
                step={15}
                value={settings.managerTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, managerTimeoutMinutes: parseInt(e.target.value) })}
                disabled={!settings.enabled}
                className="w-full"
                data-testid="slider-manager-timeout"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15 Min</span>
                <span>8 {t('admin.sessionTimeout.hours')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="polly-badge-user">User</Badge>
                  <span className="text-sm text-muted-foreground">{t('admin.sessionTimeout.shortestSessionForUsers')}</span>
                </div>
                <span className="text-sm font-medium">{formatDuration(settings.userTimeoutMinutes)}</span>
              </div>
              <Input
                type="range"
                min={5}
                max={240}
                step={5}
                value={settings.userTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, userTimeoutMinutes: parseInt(e.target.value) })}
                disabled={!settings.enabled}
                className="w-full"
                data-testid="slider-user-timeout"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 Min</span>
                <span>4 {t('admin.sessionTimeout.hours')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('admin.sessionTimeout.warningSettings')}
            </CardTitle>
            <CardDescription>
              {t('admin.roles.warnBeforeLogout')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.roles.showWarningMinutes')}</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={settings.showWarningMinutes}
                onChange={(e) => setSettings({ ...settings, showWarningMinutes: parseInt(e.target.value) || 5 })}
                disabled={!settings.enabled}
                className="w-32"
                data-testid="input-warning-minutes"
              />
              <p className="text-sm text-muted-foreground">
                {t('admin.sessionTimeout.warningNote', { minutes: settings.showWarningMinutes })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t('admin.roles.implementationNote')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('admin.sessionTimeout.sessionInfo')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-session-timeout"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              t('common.saveSettings')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
