import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Bell,
  BellRing,
  Shield,
  MessageSquare,
  ArrowLeft,
  Loader2
} from "lucide-react";

interface NotificationSettings {
  enabled: boolean;
  expiryRemindersEnabled: boolean;
  manualRemindersEnabled: boolean;
  defaultExpiryReminderHours: number;
  guestsCanSendReminders: boolean;
  guestReminderLimitPerPoll: number;
  userReminderLimitPerPoll: number;
  reminderCooldownMinutes: number;
}

export function NotificationSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    expiryRemindersEnabled: true,
    manualRemindersEnabled: true,
    defaultExpiryReminderHours: 24,
    guestsCanSendReminders: false,
    guestReminderLimitPerPoll: 1,
    userReminderLimitPerPoll: 3,
    reminderCooldownMinutes: 60,
  });

  const { data: notificationData, isLoading } = useQuery<NotificationSettings>({
    queryKey: ['/api/v1/admin/notifications'],
  });

  useEffect(() => {
    if (notificationData) {
      setSettings(notificationData);
    }
  }, [notificationData]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/notifications', newSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.notifications.saved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/notifications'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
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
        <span className="font-medium text-foreground">{t('admin.notifications.breadcrumb')}</span>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.notifications.title')}</h2>
          <p className="text-muted-foreground">{t('admin.notifications.description')}</p>
        </div>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('admin.notifications.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.notifications.globalToggle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.roles.notificationsEnabled')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.toggleAllReminders')}</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
                data-testid="switch-notifications-enabled"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" />
              {t('admin.notifications.reminderTypes')}
            </CardTitle>
            <CardDescription>
              {t('admin.notifications.whichRemindersAllowed')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.notifications.autoExpiryReminders')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.autoRemindBeforeExpiry')}</p>
              </div>
              <Switch
                checked={settings.expiryRemindersEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, expiryRemindersEnabled: v })}
                disabled={!settings.enabled}
                data-testid="switch-expiry-reminders"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.notifications.manualRemindersLabel')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.manualReminders')}</p>
              </div>
              <Switch
                checked={settings.manualRemindersEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, manualRemindersEnabled: v })}
                disabled={!settings.enabled}
                data-testid="switch-manual-reminders"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.notifications.defaultReminderTime')}</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.defaultExpiryReminderHours}
                onChange={(e) => setSettings({ ...settings, defaultExpiryReminderHours: parseInt(e.target.value) || 24 })}
                disabled={!settings.enabled || !settings.expiryRemindersEnabled}
                className="w-32"
                data-testid="input-expiry-hours"
              />
              <p className="text-sm text-muted-foreground">{t('admin.notifications.defaultInterval')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t('admin.notifications.guestRestrictions')}
            </CardTitle>
            <CardDescription>
              {t('admin.notifications.spamProtection')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertBanner variant="warning">
              <p className="text-sm">
                {t('admin.notifications.spamWarning')}
              </p>
            </AlertBanner>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.notifications.guestsCanSend')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.guestsDescription')}</p>
              </div>
              <Switch
                checked={settings.guestsCanSendReminders}
                onCheckedChange={(v) => setSettings({ ...settings, guestsCanSendReminders: v })}
                disabled={!settings.enabled || !settings.manualRemindersEnabled}
                data-testid="switch-guests-can-remind"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.notifications.maxRemindersPerPoll')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={settings.guestReminderLimitPerPoll}
                  onChange={(e) => setSettings({ ...settings, guestReminderLimitPerPoll: parseInt(e.target.value) || 0 })}
                  disabled={!settings.enabled || !settings.guestsCanSendReminders}
                  className="w-32"
                  data-testid="input-guest-limit"
                />
                <p className="text-sm text-muted-foreground">{t('admin.notifications.zeroDisabled')}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('admin.notifications.userRemindersLabel')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.userReminderLimitPerPoll}
                  onChange={(e) => setSettings({ ...settings, userReminderLimitPerPoll: parseInt(e.target.value) || 3 })}
                  disabled={!settings.enabled || !settings.manualRemindersEnabled}
                  className="w-32"
                  data-testid="input-user-limit"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.notifications.cooldownTime')}</Label>
              <Input
                type="number"
                min={10}
                max={1440}
                value={settings.reminderCooldownMinutes}
                onChange={(e) => setSettings({ ...settings, reminderCooldownMinutes: parseInt(e.target.value) || 60 })}
                disabled={!settings.enabled || !settings.manualRemindersEnabled}
                className="w-32"
                data-testid="input-cooldown"
              />
              <p className="text-sm text-muted-foreground">{t('admin.notifications.cooldownDescription')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t('admin.notifications.matrixIntegration')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('admin.notifications.matrixIntegrationHint')}{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={onBack}>
                    {t('admin.notifications.matrixIntegrationLink')}
                  </Button>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-notifications"
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
