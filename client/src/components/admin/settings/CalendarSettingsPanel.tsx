import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Calendar as CalendarIcon,
  Filter,
  Tag,
  Info,
  ArrowLeft,
  Loader2
} from "lucide-react";

interface CalendarSettings {
  prefixEnabled: boolean;
  tentativePrefix: string;
  confirmedPrefix: string;
  myChoicePrefix: string;
  exportScope: 'all' | 'own_yes' | 'final_only';
  markOwnChoices: boolean;
  highlightFinalDate: boolean;
  prefixesLocalized: Record<string, { tentative: string; confirmed: string; myChoice: string }>;
}

export function CalendarSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<CalendarSettings>({
    prefixEnabled: true,
    tentativePrefix: 'Vorläufig',
    confirmedPrefix: 'Bestätigt',
    myChoicePrefix: '[Meine Wahl]',
    exportScope: 'all',
    markOwnChoices: false,
    highlightFinalDate: true,
    prefixesLocalized: {
      de: { tentative: 'Vorläufig', confirmed: 'Bestätigt', myChoice: '[Meine Wahl]' },
      en: { tentative: 'Tentative', confirmed: 'Confirmed', myChoice: '[My Choice]' },
    },
  });

  const { data: calendarData, isLoading } = useQuery<CalendarSettings>({
    queryKey: ['/api/v1/admin/calendar'],
  });

  useEffect(() => {
    if (calendarData) {
      setSettings(calendarData);
    }
  }, [calendarData]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: CalendarSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/calendar', newSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.calendar.saved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/calendar'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const updateLocalizedPrefix = (lang: 'de' | 'en', field: 'tentative' | 'confirmed' | 'myChoice', value: string) => {
    setSettings({
      ...settings,
      prefixesLocalized: {
        ...settings.prefixesLocalized,
        [lang]: {
          ...settings.prefixesLocalized[lang],
          [field]: value,
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold">{t('admin.settings.calendar.title')}</h2>
          <p className="text-muted-foreground">{t('admin.settings.calendar.description')}</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {t('admin.calendar.prefixSettings')}
            </CardTitle>
            <CardDescription>{t('admin.calendar.prefixDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.calendar.enablePrefixes')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.calendar.enablePrefixesDescription')}</p>
              </div>
              <Switch
                checked={settings.prefixEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, prefixEnabled: v })}
                data-testid="switch-calendar-prefix-enabled"
              />
            </div>

            {settings.prefixEnabled && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">{t('admin.calendar.germanPrefixes')}</h4>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="de-tentative">{t('admin.calendar.tentativePrefix')}</Label>
                        <Input
                          id="de-tentative"
                          value={settings.prefixesLocalized.de?.tentative || ''}
                          onChange={(e) => updateLocalizedPrefix('de', 'tentative', e.target.value)}
                          placeholder="Vorläufig"
                        />
                      </div>
                      <div>
                        <Label htmlFor="de-confirmed">{t('admin.calendar.confirmedPrefix')}</Label>
                        <Input
                          id="de-confirmed"
                          value={settings.prefixesLocalized.de?.confirmed || ''}
                          onChange={(e) => updateLocalizedPrefix('de', 'confirmed', e.target.value)}
                          placeholder="Bestätigt"
                        />
                      </div>
                      <div>
                        <Label htmlFor="de-myChoice">{t('admin.calendar.myChoicePrefix')}</Label>
                        <Input
                          id="de-myChoice"
                          value={settings.prefixesLocalized.de?.myChoice || ''}
                          onChange={(e) => updateLocalizedPrefix('de', 'myChoice', e.target.value)}
                          placeholder="[Meine Wahl]"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">{t('admin.calendar.englishPrefixes')}</h4>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="en-tentative">{t('admin.calendar.tentativePrefix')}</Label>
                        <Input
                          id="en-tentative"
                          value={settings.prefixesLocalized.en?.tentative || ''}
                          onChange={(e) => updateLocalizedPrefix('en', 'tentative', e.target.value)}
                          placeholder="Tentative"
                        />
                      </div>
                      <div>
                        <Label htmlFor="en-confirmed">{t('admin.calendar.confirmedPrefix')}</Label>
                        <Input
                          id="en-confirmed"
                          value={settings.prefixesLocalized.en?.confirmed || ''}
                          onChange={(e) => updateLocalizedPrefix('en', 'confirmed', e.target.value)}
                          placeholder="Confirmed"
                        />
                      </div>
                      <div>
                        <Label htmlFor="en-myChoice">{t('admin.calendar.myChoicePrefix')}</Label>
                        <Input
                          id="en-myChoice"
                          value={settings.prefixesLocalized.en?.myChoice || ''}
                          onChange={(e) => updateLocalizedPrefix('en', 'myChoice', e.target.value)}
                          placeholder="[My Choice]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {t('admin.calendar.exportScope')}
            </CardTitle>
            <CardDescription>{t('admin.calendar.exportScopeDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={settings.exportScope}
              onValueChange={(v: 'all' | 'own_yes' | 'final_only') => setSettings({ ...settings, exportScope: v })}
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="all" id="scope-all" />
                <div>
                  <Label htmlFor="scope-all" className="font-medium">{t('admin.calendar.scopeAll')}</Label>
                  <p className="text-sm text-muted-foreground">{t('admin.calendar.scopeAllDescription')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="own_yes" id="scope-own" />
                <div>
                  <Label htmlFor="scope-own" className="font-medium">{t('admin.calendar.scopeOwnYes')}</Label>
                  <p className="text-sm text-muted-foreground">{t('admin.calendar.scopeOwnYesDescription')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="final_only" id="scope-final" />
                <div>
                  <Label htmlFor="scope-final" className="font-medium">{t('admin.calendar.scopeFinalOnly')}</Label>
                  <p className="text-sm text-muted-foreground">{t('admin.calendar.scopeFinalOnlyDescription')}</p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {t('admin.calendar.markingSettings')}
            </CardTitle>
            <CardDescription>{t('admin.calendar.markingDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.calendar.markOwnChoices')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.calendar.markOwnChoicesDescription')}</p>
              </div>
              <Switch
                checked={settings.markOwnChoices}
                onCheckedChange={(v) => setSettings({ ...settings, markOwnChoices: v })}
                data-testid="switch-calendar-mark-own"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.calendar.highlightFinal')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.calendar.highlightFinalDescription')}</p>
              </div>
              <Switch
                checked={settings.highlightFinalDate}
                onCheckedChange={(v) => setSettings({ ...settings, highlightFinalDate: v })}
                data-testid="switch-calendar-highlight-final"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t('admin.calendar.syncInfo')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('admin.calendar.syncInfoDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-calendar"
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
